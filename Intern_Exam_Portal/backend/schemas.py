from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr


# ─── Admin ────────────────────────────────────────────────────────────────────

class AdminLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class CreateAdminRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None


class AdminOut(BaseModel):
    id: int
    username: str
    is_active: bool = True
    email: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Assessment ───────────────────────────────────────────────────────────────

class AssessmentCreate(BaseModel):
    title: str
    job_position: str
    experience_level: str
    duration_minutes: int = 60


class MCQSetInfo(BaseModel):
    set_name: str
    count: int


class AssessmentOut(BaseModel):
    id: int
    title: str
    job_position: str
    experience_level: str
    duration_minutes: int = 60
    created_at: datetime
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    mcq_count: int = 0
    mcq_sets: List[MCQSetInfo] = []

    class Config:
        from_attributes = True


# ─── MCQ ─────────────────────────────────────────────────────────────────────

class MCQBase(BaseModel):
    question: str
    question_type: str = "mcq"
    subject: Optional[str] = None
    option_a: Optional[str] = None
    option_b: Optional[str] = None
    option_c: Optional[str] = None
    option_d: Optional[str] = None
    correct_answer: Optional[str] = None
    question_mark: Optional[int] = None


class MCQOut(MCQBase):
    id: int
    assessment_id: Optional[int]
    set_name: str = "Default Set"
    created_at: datetime

    class Config:
        from_attributes = True


class MCQForCandidate(BaseModel):
    id: int
    question: str
    question_type: str = "mcq"
    option_a: Optional[str] = None
    option_b: Optional[str] = None
    option_c: Optional[str] = None
    option_d: Optional[str] = None
    question_mark: Optional[int] = None   # shown to candidate so they know the weight

    class Config:
        from_attributes = True


# ─── Candidate ────────────────────────────────────────────────────────────────

class GenerateLinkRequest(BaseModel):
    name: str
    email: EmailStr
    assessment_id: int
    mcq_set_name: Optional[str] = None
    years_experience: int = 0
    require_camera: bool = False
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class GenerateLinkResponse(BaseModel):
    candidate_id: int
    name: str
    email: str
    test_link: str
    expires_at: datetime
    email_sent: bool = False
    job_position: str = ""
    assessment_title: str = ""
    experience_level: str = ""
    mcq_set_name: Optional[str] = None
    require_camera: bool = False


class CandidateSummary(BaseModel):
    id: int
    name: str
    email: str
    score: Optional[int]
    total: Optional[int]
    percentage: Optional[float]
    rank: Optional[int]
    tab_switches: int
    is_submitted: bool
    submitted_at: Optional[datetime]
    job_position: Optional[str] = None
    assessment_title: Optional[str] = None
    experience_level: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Test Session ─────────────────────────────────────────────────────────────

class VerifyEmailRequest(BaseModel):
    token: str
    email: EmailStr


class VerifyEmailResponse(BaseModel):
    candidate_id: int
    name: str
    session_id: int
    questions: List[MCQForCandidate]
    question_order: List[int]
    duration_minutes: int = 60
    elapsed_seconds: int = 0
    require_camera: bool = False


class SaveAnswerRequest(BaseModel):
    session_id: int
    mcq_id: int
    selected_option: Optional[str] = None         # for MCQ
    descriptive_answer: Optional[str] = None      # for descriptive


class SubmitTestRequest(BaseModel):
    session_id: int


class SubmitTestResponse(BaseModel):
    score: int
    total: int
    percentage: float
    has_descriptive: bool = False   # tells frontend if review is pending


class TabSwitchRequest(BaseModel):
    session_id: int
    url: Optional[str] = None


class WebcamSnapshotRequest(BaseModel):
    candidate_id: int
    tab_switch_count: int
    image_b64: str


# ─── Descriptive Grading ─────────────────────────────────────────────────────

class AwardMarksRequest(BaseModel):
    answer_id: int
    awarded_marks: int


class SendResultEmailRequest(BaseModel):
    candidate_id: int
    decision: str   # 'selected' | 'rejected'


# ─── Detailed View ────────────────────────────────────────────────────────────

class AnswerDetail(BaseModel):
    id: int
    mcq_id: int
    question: str
    question_type: str = "mcq"
    option_a: Optional[str] = None
    option_b: Optional[str] = None
    option_c: Optional[str] = None
    option_d: Optional[str] = None
    correct_answer: Optional[str] = None
    selected_option: Optional[str] = None
    descriptive_answer: Optional[str] = None
    awarded_marks: Optional[int] = None
    question_mark: Optional[int] = None
    is_correct: bool = False

    class Config:
        from_attributes = True


class SnapshotOut(BaseModel):
    id: int
    tab_switch_count: int
    image_b64: str
    captured_at: datetime

    class Config:
        from_attributes = True


class SubjectScore(BaseModel):
    subject: str
    max_score: int
    score_obtained: int
    percentage: float


class CandidateDetailResponse(BaseModel):
    id: int
    name: str
    email: str
    score: Optional[int]
    total: Optional[int]
    percentage: Optional[float]
    tab_switches: int
    submitted_at: Optional[datetime]
    answers: List[AnswerDetail]
    snapshots: List[SnapshotOut] = []
    subject_wise_scores: List[SubjectScore] = []
    job_position: Optional[str] = None
    assessment_title: Optional[str] = None
    experience_level: Optional[str] = None
    require_camera: bool = False
    descriptive_status: Optional[str] = None   # 'pending_review' | 'reviewed' | None
    has_descriptive: bool = False

    class Config:
        from_attributes = True
