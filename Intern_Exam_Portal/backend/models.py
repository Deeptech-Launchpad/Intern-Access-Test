import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base


class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    email = Column(String, nullable=True)

    assessments = relationship("Assessment", back_populates="created_by_admin")


class Assessment(Base):
    """Represents one job-role assessment (e.g. 'Software Developer – Fresher')."""
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    job_position = Column(String, nullable=False)
    experience_level = Column(String, nullable=False, default="fresher")
    duration_minutes = Column(Integer, nullable=False, default=60)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)

    mcqs = relationship("MCQ", back_populates="assessment")
    candidates = relationship("Candidate", back_populates="assessment")
    created_by_admin = relationship("Admin", back_populates="assessments")


class MCQ(Base):
    __tablename__ = "mcqs"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=True, index=True)
    set_name = Column(String, nullable=False, default="Default Set")
    subject = Column(String, nullable=True)                         # optional grouping
    question_type = Column(String, nullable=False, default="mcq")   # 'mcq' | 'descriptive'
    question = Column(Text, nullable=False)
    option_a = Column(String, nullable=True)
    option_b = Column(String, nullable=True)
    option_c = Column(String, nullable=True)
    option_d = Column(String, nullable=True)
    correct_answer = Column(String, nullable=True)                   # None for descriptive
    question_mark = Column(Integer, nullable=True, default=None)     # 2, 5, or 10 for descriptive
    created_at = Column(DateTime, default=datetime.utcnow)

    assessment = relationship("Assessment", back_populates="mcqs")
    answers = relationship("Answer", back_populates="mcq")


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, index=True)
    test_token = Column(String, unique=True, index=True)
    token_expiry = Column(DateTime, nullable=False)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=True, index=True)
    mcq_set_name = Column(String, nullable=True)
    years_experience = Column(Integer, nullable=True, default=0)
    require_camera = Column(Boolean, default=False)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    assessment = relationship("Assessment", back_populates="candidates")
    session = relationship("TestSession", back_populates="candidate", uselist=False)
    snapshots = relationship("WebcamSnapshot", back_populates="candidate")


class TestSession(Base):
    __tablename__ = "test_sessions"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), unique=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    score = Column(Integer, nullable=True)
    total = Column(Integer, nullable=True)
    tab_switches = Column(Integer, default=0)
    question_order = Column(Text, nullable=True)
    is_submitted = Column(Boolean, default=False)
    tab_switch_log = Column(Text, nullable=True)
    # descriptive grading status: 'pending_review' | 'reviewed'
    descriptive_status = Column(String, nullable=True, default=None)

    candidate = relationship("Candidate", back_populates="session")
    answers = relationship("Answer", back_populates="session")


class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("test_sessions.id"))
    mcq_id = Column(Integer, ForeignKey("mcqs.id"))
    selected_option = Column(String, nullable=True)          # 'a'/'b'/'c'/'d' for MCQ
    descriptive_answer = Column(Text, nullable=True)         # typed text for descriptive
    awarded_marks = Column(Integer, nullable=True, default=None)  # admin-awarded marks

    session = relationship("TestSession", back_populates="answers")
    mcq = relationship("MCQ", back_populates="answers")


class WebcamSnapshot(Base):
    __tablename__ = "webcam_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False, index=True)
    tab_switch_count = Column(Integer, nullable=False)
    image_b64 = Column(Text, nullable=False)
    captured_at = Column(DateTime, default=datetime.utcnow)

    candidate = relationship("Candidate", back_populates="snapshots")
