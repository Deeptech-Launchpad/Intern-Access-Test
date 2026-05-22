import json
from datetime import datetime, timezone, timedelta
from typing import List
from sqlalchemy.orm import Session
import models

IST = timezone(timedelta(hours=5, minutes=30))


def calculate_score(session: models.TestSession) -> tuple[int, int]:
    """
    Calculate score for MCQ questions only (auto-graded).
    Descriptive questions are graded manually by admin.
    Returns (mcq_correct_count, total_mcq_questions_in_session).
    """
    correct = 0
    question_order = json.loads(session.question_order or "[]")
    total_mcq = 0
    for answer in session.answers:
        if answer.mcq and answer.mcq.question_type == "mcq":
            total_mcq += 1
            if (answer.selected_option and
                    answer.selected_option.lower() == answer.mcq.correct_answer.lower()):
                correct += 1
    return correct, total_mcq


def calculate_total_score(session: models.TestSession) -> tuple[int, int]:
    """
    Calculate final score combining MCQ auto-grade + admin-awarded descriptive marks.
    Returns (total_earned, total_possible).
    total_possible = total MCQ questions + sum of all descriptive question_marks.
    """
    mcq_score, mcq_total = calculate_score(session)

    descriptive_earned = 0
    descriptive_possible = 0
    for answer in session.answers:
        if answer.mcq and answer.mcq.question_type == "descriptive":
            descriptive_possible += (answer.mcq.question_mark or 0)
            if answer.awarded_marks is not None:
                descriptive_earned += answer.awarded_marks

    total_earned = mcq_score + descriptive_earned
    total_possible = mcq_total + descriptive_possible
    return total_earned, total_possible


def has_descriptive_questions(session: models.TestSession) -> bool:
    return any(
        a.mcq and a.mcq.question_type == "descriptive"
        for a in session.answers
    )


MAX_TAB_SWITCHES = 3  # mirrors routes/candidate.py


def calculate_trust_score(session: models.TestSession, candidate: models.Candidate, snapshot_count: int) -> tuple[int, List[str]]:
    """
    Composite "Trust Score" 0-100 reflecting how clean the candidate's test-taking
    behavior was. Returns (score, list of human-readable factors that lowered it).

    Formula:
      Start at 100.
      - 25 per tab switch
      - 15 extra if auto-submitted at MAX_TAB_SWITCHES
      - 10 if test finished in less than 25% of allowed time (suspiciously fast)
      - 10 if camera was required but no snapshots were captured
      Floor at 0.
    """
    score = 100
    factors: List[str] = []

    switches = session.tab_switches or 0
    if switches > 0:
        deduction = 25 * switches
        score -= deduction
        factors.append(f"{switches} tab switch{'es' if switches != 1 else ''}: -{deduction}")

    if switches >= MAX_TAB_SWITCHES:
        score -= 15
        factors.append("Auto-submitted at tab-switch limit: -15")

    # Suspiciously fast completion
    if session.started_at and session.submitted_at:
        time_taken = (session.submitted_at - session.started_at).total_seconds()
        allowed_min = 60
        if candidate.assessment and candidate.assessment.duration_minutes:
            allowed_min = candidate.assessment.duration_minutes
        allowed_sec = allowed_min * 60
        if allowed_sec > 0 and time_taken < 0.25 * allowed_sec:
            score -= 10
            factors.append("Completed in <25% of allowed time: -10")

    # Webcam expected but missing
    if candidate.require_camera and snapshot_count == 0:
        score -= 10
        factors.append("Camera required but no snapshots captured: -10")

    return max(0, score), factors


def calculate_subject_wise_scores(session: models.TestSession) -> List[dict]:
    """
    Group this session's answers by MCQ subject and compute per-subject totals.
    - MCQ contributes max=1 / obtained=1 if correct else 0.
    - Descriptive contributes max=question_mark and obtained=awarded_marks,
      but ONLY if review is complete (descriptive_status == 'reviewed' or
      session has no descriptive questions). For 'pending_review' sessions,
      descriptive marks are excluded from subject totals — same convention as
      the overall MCQ-only score used in `grade_and_rank_candidates`.
    Missing/blank subjects fall under "General". Subjects compared case-insensitively
    and displayed in Title Case. Returns sorted alphabetically.
    """
    has_desc = has_descriptive_questions(session)
    include_descriptive = (not has_desc) or (session.descriptive_status == "reviewed")

    by_subject: dict[str, list[int]] = {}  # title-cased subject -> [max, obtained]

    for answer in session.answers:
        if not answer.mcq:
            continue
        raw = (answer.mcq.subject or "").strip()
        subject = raw.title() if raw else "General"

        entry = by_subject.setdefault(subject, [0, 0])

        if answer.mcq.question_type == "mcq":
            entry[0] += 1
            if (answer.selected_option and answer.mcq.correct_answer and
                    answer.selected_option.lower() == answer.mcq.correct_answer.lower()):
                entry[1] += 1
        elif answer.mcq.question_type == "descriptive":
            if not include_descriptive:
                continue
            mark = answer.mcq.question_mark or 0
            entry[0] += mark
            if answer.awarded_marks is not None:
                entry[1] += answer.awarded_marks

    out = []
    for subject in sorted(by_subject.keys()):
        max_score, obtained = by_subject[subject]
        pct = round((obtained / max_score) * 100, 1) if max_score > 0 else 0.0
        out.append({
            "subject": subject,
            "max_score": max_score,
            "score_obtained": obtained,
            "percentage": pct,
        })
    return out


def grade_and_rank_candidates(db: Session) -> List[dict]:
    """
    Returns all candidates with scores, ranks, statuses.
    Ranks are assigned per-assessment.
    For candidates with descriptive questions, score reflects
    MCQ marks only until admin reviews; after review it includes descriptive marks.
    """
    now_utc = datetime.utcnow()

    sessions = (
        db.query(models.TestSession)
        .filter(models.TestSession.is_submitted == True)
        .all()
    )

    by_assessment: dict[int, list] = {}
    for sess in sessions:
        candidate = sess.candidate
        assessment = candidate.assessment
        exp_level = assessment.experience_level if assessment else "fresher"

        has_desc = has_descriptive_questions(sess)
        desc_status = sess.descriptive_status  # None / 'pending_review' / 'reviewed'

        # Use combined score if reviewed, else MCQ-only score
        if has_desc and desc_status == "reviewed":
            earned, possible = calculate_total_score(sess)
        else:
            earned, possible = calculate_score(sess)
            # For display: total = total MCQ only (descriptive pending)

        percentage = round((earned / possible) * 100, 2) if possible and possible > 0 else 0.0

        tab_log = []
        if sess.tab_switch_log:
            try:
                tab_log = json.loads(sess.tab_switch_log)
            except Exception:
                pass

        assessment_id = candidate.assessment_id or 0
        entry = {
            "id": candidate.id,
            "name": candidate.name,
            "email": candidate.email,
            "score": earned,
            "total": possible,
            "percentage": percentage,
            "tab_switches": sess.tab_switches,
            "tab_switch_log": tab_log,
            "tab_switch_flagged": sess.tab_switches > 0,
            "is_submitted": True,
            "status": "submitted",
            "started_at": sess.started_at,
            "submitted_at": sess.submitted_at,
            "job_position": assessment.job_position if assessment else None,
            "assessment_title": assessment.title if assessment else None,
            "experience_level": exp_level,
            "rank": None,
            "has_descriptive": has_desc,
            "descriptive_status": desc_status,
        }
        by_assessment.setdefault(assessment_id, []).append(entry)

    ranked = []
    for assessment_id, entries in by_assessment.items():
        entries.sort(key=lambda x: x["percentage"], reverse=True)
        for i, item in enumerate(entries):
            item["rank"] = i + 1
        ranked.extend(entries)

    # Unsubmitted / not-attended
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
            "started_at": None,
            "submitted_at": None,
            "rank": None,
            "job_position": assessment.job_position if assessment else None,
            "assessment_title": assessment.title if assessment else None,
            "experience_level": exp_level,
            "has_descriptive": False,
            "descriptive_status": None,
        })

    return ranked
