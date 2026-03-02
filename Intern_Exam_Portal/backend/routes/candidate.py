import json
import random
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from utils.crypto import decode_candidate_token
from utils.grading import calculate_score

router = APIRouter(prefix="/candidate", tags=["candidate"])

MAX_TAB_SWITCHES = 3  # auto-submit threshold


def fisher_yates_shuffle(lst: list) -> list:
    """Fisher-Yates shuffle — ensures no two candidates see the same order."""
    arr = lst[:]
    n = len(arr)
    for i in range(n - 1, 0, -1):
        j = random.randint(0, i)
        arr[i], arr[j] = arr[j], arr[i]
    return arr


# ─── Email Verification & Test Start ─────────────────────────────────────────

@router.post("/verify", response_model=schemas.VerifyEmailResponse)
def verify_email(req: schemas.VerifyEmailRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_candidate_token(req.token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    candidate = db.query(models.Candidate).filter(models.Candidate.test_token == req.token).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Invalid test link")

    if candidate.email.lower() != req.email.lower():
        raise HTTPException(status_code=403, detail="Email does not match the test link")

    if datetime.utcnow() > candidate.token_expiry:
        raise HTTPException(status_code=401, detail="Test link has expired")

    session = candidate.session
    if not session:
        mcq_q = db.query(models.MCQ).filter(models.MCQ.assessment_id == candidate.assessment_id) \
            if candidate.assessment_id else db.query(models.MCQ)
        if candidate.mcq_set_name:
            mcq_q = mcq_q.filter(models.MCQ.set_name == candidate.mcq_set_name)
        all_mcqs = mcq_q.all()

        if not all_mcqs:
            raise HTTPException(status_code=400,
                detail="No questions available for this assessment. Please contact admin.")

        shuffled_ids = fisher_yates_shuffle([m.id for m in all_mcqs])
        session = models.TestSession(
            candidate_id=candidate.id,
            question_order=json.dumps(shuffled_ids),
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        for mcq_id in shuffled_ids:
            db.add(models.Answer(session_id=session.id, mcq_id=mcq_id, selected_option=None))
        db.commit()
        db.refresh(session)

    elif session.is_submitted:
        raise HTTPException(status_code=400, detail="This test has already been submitted")

    question_order = json.loads(session.question_order)
    mcq_map = {m.id: m for m in db.query(models.MCQ).filter(models.MCQ.id.in_(question_order)).all()}
    ordered_questions = [schemas.MCQForCandidate.model_validate(mcq_map[qid]) for qid in question_order if qid in mcq_map]

    return schemas.VerifyEmailResponse(
        candidate_id=candidate.id,
        name=candidate.name,
        session_id=session.id,
        questions=ordered_questions,
        question_order=question_order,
    )


# ─── Save Answer ──────────────────────────────────────────────────────────────

@router.post("/answer")
def save_answer(req: schemas.SaveAnswerRequest, db: Session = Depends(get_db)):
    session = db.query(models.TestSession).filter(models.TestSession.id == req.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.is_submitted:
        raise HTTPException(status_code=400, detail="Test already submitted")

    if req.selected_option.lower() not in ("a", "b", "c", "d"):
        raise HTTPException(status_code=422, detail="selected_option must be a, b, c, or d")

    answer = db.query(models.Answer).filter(
        models.Answer.session_id == req.session_id,
        models.Answer.mcq_id == req.mcq_id,
    ).first()

    if answer:
        answer.selected_option = req.selected_option.lower()
    else:
        db.add(models.Answer(session_id=req.session_id, mcq_id=req.mcq_id,
                             selected_option=req.selected_option.lower()))
    db.commit()
    return {"message": "Answer saved"}


# ─── Tab Switch Event ─────────────────────────────────────────────────────────

@router.post("/tab-switch")
def record_tab_switch(req: schemas.TabSwitchRequest, db: Session = Depends(get_db)):
    session = db.query(models.TestSession).filter(models.TestSession.id == req.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.is_submitted:
        return {"tab_switches": session.tab_switches, "auto_submitted": False}

    session.tab_switches += 1

    # Log the switch event with timestamp and URL hint
    log = json.loads(session.tab_switch_log or "[]")
    log.append({
        "count": session.tab_switches,
        "time": datetime.utcnow().isoformat(),
        "url": req.url or "unknown",
    })
    session.tab_switch_log = json.dumps(log)
    db.commit()

    auto_submitted = False
    if session.tab_switches >= MAX_TAB_SWITCHES:
        _do_submit(session, db)
        auto_submitted = True

    return {
        "tab_switches": session.tab_switches,
        "auto_submitted": auto_submitted,
        "remaining_switches": max(0, MAX_TAB_SWITCHES - session.tab_switches),
    }


# ─── Submit Test ──────────────────────────────────────────────────────────────

@router.post("/submit", response_model=schemas.SubmitTestResponse)
def submit_test(req: schemas.SubmitTestRequest, db: Session = Depends(get_db)):
    session = db.query(models.TestSession).filter(models.TestSession.id == req.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.is_submitted:
        return schemas.SubmitTestResponse(
            score=session.score,
            total=session.total,
            percentage=round((session.score / session.total) * 100, 2) if session.total else 0,
        )

    _do_submit(session, db)
    return schemas.SubmitTestResponse(
        score=session.score,
        total=session.total,
        percentage=round((session.score / session.total) * 100, 2) if session.total else 0,
    )


def _do_submit(session: models.TestSession, db: Session):
    db.refresh(session)
    score, total = calculate_score(session)
    session.score = score
    session.total = total
    session.submitted_at = datetime.utcnow()
    session.is_submitted = True
    db.commit()


# ─── Get Session Answers (for resume) ────────────────────────────────────────

@router.get("/session/{session_id}/answers")
def get_session_answers(session_id: int, db: Session = Depends(get_db)):
    answers = db.query(models.Answer).filter(models.Answer.session_id == session_id).all()
    result = {}
    for ans in answers:
        if ans.selected_option:
            result[str(ans.mcq_id)] = ans.selected_option
    return {"answers": result}
