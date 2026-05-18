import random
from datetime import datetime
from typing import Optional
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
from utils.email_sender import send_test_link_email, send_assessment_report_email

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
    new_admin = models.Admin(
        username=req.username,
        hashed_password=auth.get_password_hash(req.password),
        email=req.email.strip().lower() if req.email else None,
    )
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
        duration_minutes=req.duration_minutes,
        created_by_id=current_admin.id,
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
            require_camera=candidate.require_camera,
        )

    # Look for a candidate with this exact email + assessment who has NOT yet submitted.
    # If found, reuse that row (just refresh the token). For any other case – different
    # assessment, or the previous attempt is already submitted – always create a fresh
    # Candidate record so historical results are never overwritten.
    existing = db.query(models.Candidate).filter(
        models.Candidate.email == req.email,
        models.Candidate.assessment_id == req.assessment_id,
    ).first()
    if existing and not (existing.session and existing.session.is_submitted):
        # Same assessment, not yet submitted – clear any in-progress session and refresh token
        if existing.session:
            db.query(models.Answer).filter(models.Answer.session_id == existing.session.id).delete()
            db.query(models.WebcamSnapshot).filter(models.WebcamSnapshot.candidate_id == existing.id).delete()
            db.delete(existing.session)
            db.flush()
        token, expiry = generate_candidate_token(existing.id, req.email)
        existing.test_token = token
        existing.token_expiry = expiry
        existing.mcq_set_name = req.mcq_set_name
        existing.years_experience = years_experience
        existing.require_camera = req.require_camera
        existing.start_date = req.start_date
        existing.end_date = req.end_date
        db.commit(); db.refresh(existing)
        return _create_response(existing, token, expiry)
    # Fall through: create a brand-new Candidate record to preserve previous records

    candidate = models.Candidate(
        name=req.name, email=req.email,
        test_token="temp", token_expiry=datetime.utcnow(),
        assessment_id=req.assessment_id,
        mcq_set_name=req.mcq_set_name,
        years_experience=years_experience,
        require_camera=req.require_camera,
        start_date=req.start_date,
        end_date=req.end_date,
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
            submitted_at=None, answers=[], snapshots=[],
            job_position=assessment.job_position if assessment else None,
            assessment_title=assessment.title if assessment else None,
            experience_level=exp_level,
            require_camera=candidate.require_camera,
            descriptive_status=None,
            has_descriptive=False,
        )

    percentage = round((session.score / session.total) * 100, 2) if session.total else None
    from utils.grading import has_descriptive_questions
    has_desc = has_descriptive_questions(session)
    answers_detail = []
    for ans in session.answers:
        if ans.mcq.question_type == "descriptive":
            is_correct = False
        else:
            is_correct = bool(ans.selected_option and ans.mcq.correct_answer and
                              ans.selected_option.lower() == ans.mcq.correct_answer.lower())
        answers_detail.append(schemas.AnswerDetail(
            id=ans.id,
            mcq_id=ans.mcq_id, question=ans.mcq.question,
            question_type=ans.mcq.question_type,
            option_a=ans.mcq.option_a, option_b=ans.mcq.option_b,
            option_c=ans.mcq.option_c, option_d=ans.mcq.option_d,
            correct_answer=ans.mcq.correct_answer,
            selected_option=ans.selected_option,
            descriptive_answer=ans.descriptive_answer,
            awarded_marks=ans.awarded_marks,
            question_mark=ans.mcq.question_mark,
            is_correct=is_correct,
        ))

    snapshots = [
        schemas.SnapshotOut(
            id=s.id,
            tab_switch_count=s.tab_switch_count,
            image_b64=s.image_b64,
            captured_at=s.captured_at,
        )
        for s in candidate.snapshots
    ]

    return schemas.CandidateDetailResponse(
        id=candidate.id, name=candidate.name, email=candidate.email,
        score=session.score, total=session.total, percentage=percentage,
        tab_switches=session.tab_switches, submitted_at=session.submitted_at,
        answers=answers_detail,
        snapshots=snapshots,
        job_position=assessment.job_position if assessment else None,
        assessment_title=assessment.title if assessment else None,
        experience_level=exp_level,
        require_camera=candidate.require_camera,
        descriptive_status=session.descriptive_status,
        has_descriptive=has_desc,
    )


# ─── MCQ Preview ─────────────────────────────────────────────────────────────

@router.get("/assessments/{assessment_id}/mcqs", response_model=list[schemas.MCQOut])
def preview_mcqs(
    assessment_id: int,
    set_name: str = Query(None, description="Filter by set name; omit for all"),
    db: Session = Depends(get_db),
    current_admin: models.Admin = Depends(auth.get_current_admin),
):
    """Return all MCQs for an assessment (optionally filtered by set)."""
    q = db.query(models.MCQ).filter(models.MCQ.assessment_id == assessment_id)
    if set_name:
        q = q.filter(models.MCQ.set_name == set_name)
    return q.order_by(models.MCQ.set_name, models.MCQ.id).all()


# ─── Duplicate Assessment ─────────────────────────────────────────────────────

@router.post("/assessments/{assessment_id}/duplicate", response_model=schemas.AssessmentOut, status_code=201)
def duplicate_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_admin: models.Admin = Depends(auth.get_current_admin),
):
    """Clone an assessment along with all its MCQ sets."""
    src = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Assessment not found")

    new_assessment = models.Assessment(
        title=f"{src.title} (Copy)",
        job_position=src.job_position,
        experience_level=src.experience_level,
        duration_minutes=src.duration_minutes,
    )
    db.add(new_assessment)
    db.flush()  # get new_assessment.id

    # Clone all MCQs
    src_mcqs = db.query(models.MCQ).filter(models.MCQ.assessment_id == assessment_id).all()
    for mcq in src_mcqs:
        db.add(models.MCQ(
            assessment_id=new_assessment.id,
            set_name=mcq.set_name,
            question=mcq.question,
            option_a=mcq.option_a,
            option_b=mcq.option_b,
            option_c=mcq.option_c,
            option_d=mcq.option_d,
            correct_answer=mcq.correct_answer,
        ))
    db.commit()
    db.refresh(new_assessment)
    return _build_assessment_out(new_assessment, db)


# ─── Resend Test Link ─────────────────────────────────────────────────────────

@router.post("/candidates/{candidate_id}/resend-link", response_model=schemas.GenerateLinkResponse)
def resend_link(
    candidate_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_admin: models.Admin = Depends(auth.get_current_admin),
):
    """Generate a fresh token for an existing candidate and re-send the email."""
    from utils.crypto import generate_candidate_token

    candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    assessment = candidate.assessment
    if not assessment:
        raise HTTPException(status_code=400, detail="Candidate has no assessment assigned")

    if candidate.session and candidate.session.is_submitted:
        # Previous attempt is already submitted – create a fresh Candidate row to preserve history
        new_candidate = models.Candidate(
            name=candidate.name,
            email=candidate.email,
            test_token="temp",
            token_expiry=datetime.utcnow(),
            assessment_id=candidate.assessment_id,
            mcq_set_name=candidate.mcq_set_name,
            years_experience=candidate.years_experience,
            require_camera=candidate.require_camera,
        )
        db.add(new_candidate)
        db.commit()
        db.refresh(new_candidate)
        token, expiry = generate_candidate_token(new_candidate.id, new_candidate.email)
        new_candidate.test_token = token
        new_candidate.token_expiry = expiry
        db.commit()
        db.refresh(new_candidate)
        candidate = new_candidate
    else:
        # Not yet submitted – clear any in-progress session and refresh token
        if candidate.session:
            db.query(models.Answer).filter(models.Answer.session_id == candidate.session.id).delete()
            db.query(models.WebcamSnapshot).filter(models.WebcamSnapshot.candidate_id == candidate.id).delete()
            db.delete(candidate.session)
            db.flush()
        token, expiry = generate_candidate_token(candidate.id, candidate.email)
        candidate.test_token = token
        candidate.token_expiry = expiry
        db.commit()
        db.refresh(candidate)

    from datetime import timezone, timedelta
    IST = timezone(timedelta(hours=5, minutes=30))
    expiry_ist = expiry.replace(tzinfo=timezone.utc).astimezone(IST)
    expiry_str = expiry_ist.strftime("%Y-%m-%d %I:%M %p")
    link = f"{FRONTEND_URL}/test/{token}"

    background_tasks.add_task(
        send_test_link_email,
        candidate.name, candidate.email, link, expiry_str,
        assessment.job_position, assessment.title, assessment.experience_level,
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
        experience_level=assessment.experience_level,
        mcq_set_name=candidate.mcq_set_name,
    )


# ─── Bulk Candidate Invite ────────────────────────────────────────────────────

@router.post("/bulk-invite")
async def bulk_invite(
    assessment_id: int = Query(...),
    mcq_set_name: str = Query(None),
    require_camera: bool = Query(False),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_admin: models.Admin = Depends(auth.get_current_admin),
):
    """
    Accept a CSV or Excel (.xlsx/.xls) file with columns: name, email
    Generate links and email all candidates in one shot.
    """
    import csv, io

    assessment = db.query(models.Assessment).filter(models.Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    fname = file.filename.lower()
    if not (fname.endswith(".csv") or fname.endswith(".xlsx") or fname.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Please upload a CSV (.csv) or Excel (.xlsx / .xls) file")

    raw = await file.read()

    try:
        if fname.endswith(".csv"):
            text = raw.decode("utf-8-sig")  # handle BOM
            reader = csv.DictReader(io.StringIO(text))
            rows = [dict(r) for r in reader]
        else:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
            ws = wb.active
            all_rows = list(ws.iter_rows(values_only=True))
            if not all_rows:
                raise ValueError("Spreadsheet is empty")
            headers = [str(h).strip() if h is not None else "" for h in all_rows[0]]
            rows = [
                {headers[i]: (str(cell).strip() if cell is not None else "") for i, cell in enumerate(row)}
                for row in all_rows[1:]
            ]
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse file: {e}")

    if not rows:
        raise HTTPException(status_code=422, detail="File is empty or has no data rows")

    # Normalise headers
    headers_lower = {k.strip().lower(): k for k in rows[0].keys()}
    if "name" not in headers_lower or "email" not in headers_lower:
        raise HTTPException(status_code=422, detail="File must have 'name' and 'email' columns")

    # Validate MCQ set
    mcq_q = db.query(models.MCQ).filter(models.MCQ.assessment_id == assessment_id)
    if mcq_set_name:
        mcq_q = mcq_q.filter(models.MCQ.set_name == mcq_set_name)
    if mcq_q.count() == 0:
        raise HTTPException(status_code=400, detail="No MCQs found for this assessment / set")

    from utils.crypto import generate_candidate_token
    from datetime import timezone, timedelta

    IST = timezone(timedelta(hours=5, minutes=30))
    years_experience = 1 if assessment.experience_level == "experienced" else 0

    results = []
    for row in rows:
        name = row.get(headers_lower.get("name", "name"), "").strip()
        email = row.get(headers_lower.get("email", "email"), "").strip().lower()
        if not name or not email or "@" not in email:
            results.append({"name": name, "email": email, "status": "skipped", "reason": "invalid"})
            continue

        # Look for a candidate with this exact email + assessment who has NOT yet submitted.
        # Reuse that row if found; otherwise always create a new row to preserve history.
        candidate = db.query(models.Candidate).filter(
            models.Candidate.email == email,
            models.Candidate.assessment_id == assessment_id,
        ).first()
        token, expiry = generate_candidate_token(0, email)
        if candidate and not (candidate.session and candidate.session.is_submitted):
            # Same assessment, not yet submitted – clear any in-progress session and reuse
            if candidate.session:
                db.query(models.Answer).filter(models.Answer.session_id == candidate.session.id).delete()
                db.query(models.WebcamSnapshot).filter(models.WebcamSnapshot.candidate_id == candidate.id).delete()
                db.delete(candidate.session)
                db.flush()
            candidate.mcq_set_name = mcq_set_name
            candidate.years_experience = years_experience
            candidate.require_camera = require_camera
            candidate.start_date = start_date
            candidate.end_date = end_date
        else:
            # New assessment or previous attempt already submitted – create a fresh row
            candidate = models.Candidate(
                name=name, email=email,
                test_token="temp", token_expiry=expiry,
                assessment_id=assessment_id,
                mcq_set_name=mcq_set_name,
                years_experience=years_experience,
                require_camera=require_camera,
                start_date=start_date,
                end_date=end_date,
            )
            db.add(candidate)
            db.flush()

        token, expiry = generate_candidate_token(candidate.id, email)
        candidate.test_token = token
        candidate.token_expiry = expiry
        db.flush()

        link = f"{FRONTEND_URL}/test/{token}"
        expiry_ist = expiry.replace(tzinfo=timezone.utc).astimezone(IST)
        expiry_str = expiry_ist.strftime("%Y-%m-%d %I:%M %p")

        background_tasks.add_task(
            send_test_link_email,
            candidate.name, candidate.email, link, expiry_str,
            assessment.job_position, assessment.title, assessment.experience_level,
        )
        results.append({"name": name, "email": email, "status": "invited", "test_link": link})

    db.commit()
    invited = sum(1 for r in results if r["status"] == "invited")
    skipped = len(results) - invited
    return {"invited": invited, "skipped": skipped, "results": results}


# ─── Descriptive Grading: Award Marks ────────────────────────────────────────

@router.post("/award-marks")
def award_marks(
    req: schemas.AwardMarksRequest,
    db: Session = Depends(get_db),
    current_admin: models.Admin = Depends(auth.get_current_admin),
):
    """Admin awards marks to a descriptive answer."""
    answer = db.query(models.Answer).filter(models.Answer.id == req.answer_id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    if not answer.mcq or answer.mcq.question_type != "descriptive":
        raise HTTPException(status_code=400, detail="This answer is not a descriptive question")
    max_mark = answer.mcq.question_mark or 0
    if req.awarded_marks < 0 or req.awarded_marks > max_mark:
        raise HTTPException(
            status_code=422,
            detail=f"Awarded marks must be between 0 and {max_mark}"
        )
    answer.awarded_marks = req.awarded_marks
    db.commit()
    return {"message": "Marks awarded", "answer_id": answer.id, "awarded_marks": answer.awarded_marks}


@router.post("/finalize-descriptive/{session_id}")
def finalize_descriptive_review(
    session_id: int,
    db: Session = Depends(get_db),
    current_admin: models.Admin = Depends(auth.get_current_admin),
):
    """
    Mark all descriptive questions as reviewed and recalculate final score.
    Call this after admin has awarded marks to all descriptive answers.
    """
    from utils.grading import calculate_total_score
    session = db.query(models.TestSession).filter(models.TestSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    earned, possible = calculate_total_score(session)
    session.score = earned
    session.total = possible
    session.descriptive_status = "reviewed"
    db.commit()

    percentage = round((earned / possible) * 100, 2) if possible else 0.0
    return {
        "message": "Review finalized",
        "score": earned,
        "total": possible,
        "percentage": percentage,
    }


# ─── Send Result Email to Candidate ──────────────────────────────────────────

@router.post("/send-result-email")
def send_result_email(
    req: schemas.SendResultEmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_admin: models.Admin = Depends(auth.get_current_admin),
):
    """
    Admin triggers a Selected or Rejected email to the candidate.
    decision: 'selected' | 'rejected'
    """
    from utils.email_sender import send_candidate_result_email

    if req.decision not in ("selected", "rejected"):
        raise HTTPException(status_code=422, detail="decision must be 'selected' or 'rejected'")

    candidate = db.query(models.Candidate).filter(models.Candidate.id == req.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    assessment = candidate.assessment
    job_position = assessment.job_position if assessment else ""
    assessment_title = assessment.title if assessment else "Assessment"

    session = candidate.session
    score = session.score if session else None
    total = session.total if session else None
    percentage = round((score / total) * 100, 2) if score is not None and total else None

    background_tasks.add_task(
        send_candidate_result_email,
        candidate.name,
        candidate.email,
        job_position,
        assessment_title,
        req.decision,
        score,
        total,
        percentage,
    )
    return {"message": f"Result email ({req.decision}) queued for {candidate.email}"}


@router.post("/finalize-descriptive-by-candidate/{candidate_id}")
def finalize_descriptive_by_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_admin: models.Admin = Depends(auth.get_current_admin),
):
    """Finalize descriptive review using candidate_id (convenience wrapper)."""
    from utils.grading import calculate_total_score
    candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    session = candidate.session
    if not session:
        raise HTTPException(status_code=404, detail="No test session found for this candidate")

    earned, possible = calculate_total_score(session)
    session.score = earned
    session.total = possible
    session.descriptive_status = "reviewed"
    db.commit()

    percentage = round((earned / possible) * 100, 2) if possible else 0.0
    return {
        "message": "Review finalized",
        "score": earned,
        "total": possible,
        "percentage": percentage,
    }
