import json
from datetime import datetime, timezone, timedelta
from typing import List
from sqlalchemy.orm import Session
import models

IST = timezone(timedelta(hours=5, minutes=30))


def calculate_score(session: models.TestSession) -> tuple[int, int]:
    """Calculate score: (correct_count, total_questions_in_session)."""
    correct = 0
    total = len(json.loads(session.question_order or "[]"))  # total = questions assigned, not just answered
    for answer in session.answers:
        if answer.selected_option and answer.selected_option.lower() == answer.mcq.correct_answer.lower():
            correct += 1
    return correct, total


def grade_and_rank_candidates(db: Session) -> List[dict]:
    """
    Returns all candidates with scores, ranks, statuses.
    Status logic:
    - Submitted: test completed
    - Not Attended: link expired, no session started
    - Pending: session exists but not submitted
    """
    now_utc = datetime.utcnow()

    sessions = (
        db.query(models.TestSession)
        .filter(models.TestSession.is_submitted == True)
        .all()
    )

    ranked = []
    for sess in sessions:
        candidate = sess.candidate
        assessment = candidate.assessment
        exp_level = assessment.experience_level if assessment else "fresher"
        percentage = round((sess.score / sess.total) * 100, 2) if sess.total and sess.total > 0 else 0.0
        # Parse tab switch log
        tab_log = []
        if sess.tab_switch_log:
            try:
                tab_log = json.loads(sess.tab_switch_log)
            except Exception:
                pass
        ranked.append({
            "id": candidate.id,
            "name": candidate.name,
            "email": candidate.email,
            "score": sess.score,
            "total": sess.total,
            "percentage": percentage,
            "tab_switches": sess.tab_switches,
            "tab_switch_log": tab_log,
            "tab_switch_flagged": sess.tab_switches > 0,
            "is_submitted": True,
            "status": "submitted",
            "submitted_at": sess.submitted_at,
            "job_position": assessment.job_position if assessment else None,
            "assessment_title": assessment.title if assessment else None,
            "experience_level": exp_level,
            "rank": None,
        })

    # Sort by percentage descending, assign ranks
    ranked.sort(key=lambda x: x["percentage"], reverse=True)
    for i, item in enumerate(ranked):
        item["rank"] = i + 1

    # Add unsubmitted / not-attended candidates
    all_candidates = db.query(models.Candidate).all()
    submitted_ids = {r["id"] for r in ranked}

    for candidate in all_candidates:
        if candidate.id in submitted_ids:
            continue
        assessment = candidate.assessment
        exp_level = assessment.experience_level if assessment else "fresher"
        has_session = candidate.session is not None
        link_expired = candidate.token_expiry < now_utc if candidate.token_expiry else True

        if not has_session and link_expired:
            status = "not_attended"
        elif has_session and not candidate.session.is_submitted:
            status = "pending"
        else:
            status = "pending"

        tab_log = []
        tab_switches = 0
        if has_session:
            tab_switches = candidate.session.tab_switches
            if candidate.session.tab_switch_log:
                try:
                    tab_log = json.loads(candidate.session.tab_switch_log)
                except Exception:
                    pass

        ranked.append({
            "id": candidate.id,
            "name": candidate.name,
            "email": candidate.email,
            "score": None,
            "total": None,
            "percentage": None,
            "tab_switches": tab_switches,
            "tab_switch_log": tab_log,
            "tab_switch_flagged": tab_switches > 0,
            "is_submitted": False,
            "status": status,
            "submitted_at": None,
            "rank": None,
            "job_position": assessment.job_position if assessment else None,
            "assessment_title": assessment.title if assessment else None,
            "experience_level": exp_level,
        })

    return ranked
