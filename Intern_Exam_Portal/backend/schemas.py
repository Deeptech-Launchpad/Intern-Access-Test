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


class AdminOut(BaseModel):
    id: int
    username: str
    is_active: bool = True

    class Config:
        from_attributes = True


# ─── Assessment ───────────────────────────────────────────────────────────────

class AssessmentCreate(BaseModel):
    title: str
    job_position: str
    experience_level: str  # 'fresher' | 'experienced'


class MCQSetInfo(BaseModel):
    """Summary of one named question set within an assessment."""
    set_name: str
    count: int


class AssessmentOut(BaseModel):
    id: int
    title: str
    job_position: str
    experience_level: str
    created_at: datetime
    mcq_count: int = 0
    mcq_sets: List[MCQSetInfo] = []

    class Config:
        from_attributes = True


# ─── MCQ ─────────────────────────────────────────────────────────────────────

class MCQBase(BaseModel):
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str


class MCQOut(MCQBase):
    id: int
    assessment_id: Optional[int]
    set_name: str = "Default Set"
    created_at: datetime

    class Config:
        from_attributes = True


class MCQForCandidate(BaseModel):
    """MCQ shown to candidate — NO correct answer exposed."""
    id: int
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str

    class Config:
        from_attributes = True


# ─── Candidate ────────────────────────────────────────────────────────────────

class GenerateLinkRequest(BaseModel):
    name: str
    email: EmailStr
    assessment_id: int
    mcq_set_name: Optional[str] = None   # which question set to assign; None = all in assessment
    years_experience: int = 0


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


class SaveAnswerRequest(BaseModel):
    session_id: int
    mcq_id: int
    selected_option: str  # 'a', 'b', 'c', 'd'


class SubmitTestRequest(BaseModel):
    session_id: int


class SubmitTestResponse(BaseModel):
    score: int
    total: int
    percentage: float


class TabSwitchRequest(BaseModel):
    session_id: int
    url: Optional[str] = None  # the URL/tab title the user switched to


# ─── Detailed View ────────────────────────────────────────────────────────────

class AnswerDetail(BaseModel):
    mcq_id: int
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    selected_option: Optional[str]
    is_correct: bool

    class Config:
        from_attributes = True


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
    job_position: Optional[str] = None
    assessment_title: Optional[str] = None
    experience_level: Optional[str] = None
