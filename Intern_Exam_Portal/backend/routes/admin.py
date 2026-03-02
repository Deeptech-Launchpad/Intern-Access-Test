import random
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
import auth
from utils.crypto import generate_candidate_token
from utils.grading import grade_and_rank_candidates
from utils.excel_parser import parse_mcq_excel
from utils.email_sender import send_test_link_email

import os
router = APIRouter(prefix="/admin", tags=["admin"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


# ─── Login ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=schemas.Token)
def admin_login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    admin = db.query(models.Admin).filter(models.Admin.username == form_data.username).first()
    if not admin or not auth.verify_password(form_data.password, admin.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    if not admin.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact the Admin.")
    access_token = auth.create_access_token(data={"sub": admin.username})
    return {"access_token": access_token, "token_type": "bearer"}


# ─── Admin Management ─────────────────────────────────────────────────────────

@router.post("/create-admin", response_model=schemas.AdminOut, status_code=201)
def create_admin(req: schemas.CreateAdminRequest, db: Session = Depends(get_db),
                 current_admin: models.Admin = Depends(auth.get_current_admin)):
    existing = db.query(models.Admin).filter(models.Admin.username == req.username).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Admin '{req.username}' already exists")
    if len(req.password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")
    new_admin = models.Admin(username=req.username, hashed_password=auth.get_password_hash(req.password))
    db.add(new_admin); db.commit(); db.refresh(new_admin)
    return new_admin


@router.get("/admins", response_model=list[schemas.AdminOut])
def list_admins(db: Session = Depends(get_db), current_admin: models.Admin = Depends(auth.get_current_admin)):
    return db.query(models.Admin).all()


@router.patch("/admins/{admin_id}/toggle-active", response_model=schemas.AdminOut)
def toggle_admin_active(admin_id: int, db: Session = Depends(get_db),
                        current_admin: models.Admin = Depends(auth.get_current_admin)):
    """Flip the is_active flag for any admin except yourself."""
    if admin_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own active status")
    admin = db.query(models.Admin).filter(models.Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    admin.is_active = not admin.is_active
    db.commit(); db.refresh(admin)
    return admin


@router.delete("/admins/{admin_id}", status_code=204)
def delete_admin(admin_id: int, db: Session = Depends(get_db),
                 current_admin: models.Admin = Depends(auth.get_current_admin)):
    if admin_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    admin = db.query(models.Admin).filter(models.Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    db.delete(admin); db.commit()


# ─── Assessment Management ────────────────────────────────────────────────────

def _build_assessment_out(a: models.Assessment, db: Session) -> schemas.AssessmentOut:
    """Build AssessmentOut with mcq_count and per-set breakdown."""
    sets_raw = (
        db.query(models.MCQ.set_name, func.count(models.MCQ.id).label("cnt"))
        .filter(models.MCQ.assessment_id == a.id)
        .group_by(models.MCQ.set_name)
        .all()
    )
    mcq_sets = [schemas.MCQSetInfo(set_name=s, count=c) for s, c in sets_raw]
    total = sum(s.count for s in mcq_sets)
    out = schemas.AssessmentOut.model_validate(a)
    out.mcq_count = total
    out.mcq_sets = mcq_sets
    return out


@router.post("/assessments", response_model=schemas.AssessmentOut, status_code=201)
def create_assessment(req: schemas.AssessmentCreate, db: Session = Depends(get_db),
                      current_admin: models.Admin = Depends(auth.get_current_admin)):
    if req.experience_level not in ("fresher", "experienced"):
        raise HTTPException(status_code=422, detail="experience_level must be 'fresher' or 'experienced'")
    assessment = models.Assessment(
        title=req.title.strip(),
        job_position=req.job_position.strip(),
        experience_level=req.experience_level,
    )
    db.add(assessment); db.commit(); db.refresh(assessment)
    return _build_assessment_out(assessment, db)


@router.get("/assessments", response_model=list[schemas.AssessmentOut])
def list_assessments(db: Session = Depends(get_db),
                     current_admin: models.Admin = Depends(auth.get_current_admin)):
    assessments = db.query(models.Assessment).order_by(models.Assessment.created_at.desc()).all()
    return [_build_assessment_out(a, db) for a in assessments]


@router.delete("/assessments/{assessment_id}", status_code=204)
def delete_assessment(assessment_id: int, db: Session = Depends(get_db),
                      current_admin: models.Admin = Depends(auth.get_current_admin)):
    assessment = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    db.delete(assessment); db.commit()


# ─── MCQ Upload (per assessment, per set) ────────────────────────────────────

@router.post("/upload-mcqs")
async def upload_mcqs(
    assessment_id: int = Query(..., description="Assessment ID"),
    set_name: str = Query("Default Set", description="Name for this question set"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_admin: models.Admin = Depends(auth.get_current_admin),
):
    assessment = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Please upload an Excel file (.xlsx or .xls)")

    file_bytes = await file.read()
    try:
        mcq_data = parse_mcq_excel(file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    clean_set_name = set_name.strip() or "Default Set"

    # Delete existing MCQs for this specific set before re-uploading
    db.query(models.MCQ).filter(
        models.MCQ.assessment_id == assessment_id,
        models.MCQ.set_name == clean_set_name,
    ).delete()

    for item in mcq_data:
        item["assessment_id"] = assessment_id
        item["set_name"] = clean_set_name
        db.add(models.MCQ(**item))
    db.commit()

    total = db.query(models.MCQ).filter(models.MCQ.assessment_id == assessment_id).count()
    return {
        "message": f"Uploaded {len(mcq_data)} questions to '{clean_set_name}' in '{assessment.title}'",
        "added": len(mcq_data),
        "set_name": clean_set_name,
        "total_for_assessment": total,
    }


@router.delete("/assessments/{assessment_id}/mcq-sets/{set_name}", status_code=204)
def delete_mcq_set(assessment_id: int, set_name: str, db: Session = Depends(get_db),
                   current_admin: models.Admin = Depends(auth.get_current_admin)):
    """Delete all MCQs in a specific named set."""
    db.query(models.MCQ).filter(
        models.MCQ.assessment_id == assessment_id,
        models.MCQ.set_name == set_name,
    ).delete()
    db.commit()


# ─── Generate Candidate Link ──────────────────────────────────────────────────

@router.post("/generate-link", response_model=schemas.GenerateLinkResponse)
def generate_link(req: schemas.GenerateLinkRequest, background_tasks: BackgroundTasks,
                  db: Session = Depends(get_db),
                  current_admin: models.Admin = Depends(auth.get_current_admin)):
    assessment = db.query(models.Assessment).filter(models.Assessment.id == req.assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    experience_level = assessment.experience_level
    years_experience = 1 if experience_level == "experienced" else 0

    # Validate MCQ set exists
    mcq_q = db.query(models.MCQ).filter(models.MCQ.assessment_id == req.assessment_id)
    if req.mcq_set_name:
        mcq_q = mcq_q.filter(models.MCQ.set_name == req.mcq_set_name)
    mcq_count = mcq_q.count()
    if mcq_count == 0:
        set_label = f"set '{req.mcq_set_name}'" if req.mcq_set_name else "this assessment"
        raise HTTPException(status_code=400,
            detail=f"No MCQs found for {set_label}. Please upload questions first.")

    def _create_response(candidate: models.Candidate, token: str, expiry: datetime) -> schemas.GenerateLinkResponse:
        link = f"{FRONTEND_URL}/test/{token}"
        # Convert UTC expiry to IST (UTC+5:30) for the email
        from datetime import timezone, timedelta
        IST = timezone(timedelta(hours=5, minutes=30))
        expiry_ist = expiry.replace(tzinfo=timezone.utc).astimezone(IST)
        expiry_str = expiry_ist.strftime("%Y-%m-%d %I:%M %p")

        background_tasks.add_task(
            send_test_link_email,
            candidate.name, candidate.email, link, expiry_str,
            assessment.job_position, assessment.title, experience_level,
        )
        return schemas.GenerateLinkResponse(
            candidate_id=candidate.id,
            name=candidate.name,
            email=candidate.email,
            test_link=link,
            expires_at=expiry,
            email_sent=True,
            job_position=assessment.job_position,
            assessment_title=assessment.title,
            experience_level=experience_level,
            mcq_set_name=candidate.mcq_set_name,
        )

    existing = db.query(models.Candidate).filter(models.Candidate.email == req.email).first()
    if existing:
        token, expiry = generate_candidate_token(existing.id, req.email)
        existing.test_token = token
        existing.token_expiry = expiry
        existing.assessment_id = req.assessment_id
        existing.mcq_set_name = req.mcq_set_name
        existing.years_experience = years_experience
        db.commit(); db.refresh(existing)
        return _create_response(existing, token, expiry)

    candidate = models.Candidate(
        name=req.name, email=req.email,
        test_token="temp", token_expiry=datetime.utcnow(),
        assessment_id=req.assessment_id,
        mcq_set_name=req.mcq_set_name,
        years_experience=years_experience,
    )
    db.add(candidate); db.commit(); db.refresh(candidate)
    token, expiry = generate_candidate_token(candidate.id, req.email)
    candidate.test_token = token
    candidate.token_expiry = expiry
    db.commit(); db.refresh(candidate)
    return _create_response(candidate, token, expiry)


# ─── Grading Dashboard ────────────────────────────────────────────────────────

@router.get("/candidates")
def get_all_candidates(db: Session = Depends(get_db),
                       current_admin: models.Admin = Depends(auth.get_current_admin)):
    return {"candidates": grade_and_rank_candidates(db)}


@router.get("/candidate/{candidate_id}", response_model=schemas.CandidateDetailResponse)
def get_candidate_detail(candidate_id: int, db: Session = Depends(get_db),
                         current_admin: models.Admin = Depends(auth.get_current_admin)):
    candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    assessment = candidate.assessment
    exp_level = assessment.experience_level if assessment else "fresher"
    session = candidate.session

    if not session:
        return schemas.CandidateDetailResponse(
            id=candidate.id, name=candidate.name, email=candidate.email,
            score=None, total=None, percentage=None, tab_switches=0,
            submitted_at=None, answers=[],
            job_position=assessment.job_position if assessment else None,
            assessment_title=assessment.title if assessment else None,
            experience_level=exp_level,
        )

    percentage = round((session.score / session.total) * 100, 2) if session.total else None
    answers_detail = []
    for ans in session.answers:
        is_correct = bool(ans.selected_option and
                          ans.selected_option.lower() == ans.mcq.correct_answer.lower())
        answers_detail.append(schemas.AnswerDetail(
            mcq_id=ans.mcq_id, question=ans.mcq.question,
            option_a=ans.mcq.option_a, option_b=ans.mcq.option_b,
            option_c=ans.mcq.option_c, option_d=ans.mcq.option_d,
            correct_answer=ans.mcq.correct_answer,
            selected_option=ans.selected_option, is_correct=is_correct,
        ))

    return schemas.CandidateDetailResponse(
        id=candidate.id, name=candidate.name, email=candidate.email,
        score=session.score, total=session.total, percentage=percentage,
        tab_switches=session.tab_switches, submitted_at=session.submitted_at,
        answers=answers_detail,
        job_position=assessment.job_position if assessment else None,
        assessment_title=assessment.title if assessment else None,
        experience_level=exp_level,
    )
