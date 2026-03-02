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
    is_active = Column(Boolean, default=True)  # False = locked out


class Assessment(Base):
    """Represents one job-role assessment (e.g. 'Software Developer – Fresher')."""
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)          # e.g. "Q1 2025 Intern Round"
    job_position = Column(String, nullable=False)   # e.g. "Software Developer"
    experience_level = Column(String, nullable=False, default="fresher")  # 'fresher' | 'experienced'
    created_at = Column(DateTime, default=datetime.utcnow)

    mcqs = relationship("MCQ", back_populates="assessment")
    candidates = relationship("Candidate", back_populates="assessment")


class MCQ(Base):
    __tablename__ = "mcqs"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=True, index=True)
    set_name = Column(String, nullable=False, default="Default Set")  # question set name within an assessment
    question = Column(Text, nullable=False)
    option_a = Column(String, nullable=False)
    option_b = Column(String, nullable=False)
    option_c = Column(String, nullable=False)
    option_d = Column(String, nullable=False)
    correct_answer = Column(String, nullable=False)  # 'a', 'b', 'c', or 'd'
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
    mcq_set_name = Column(String, nullable=True)  # which question set they are assigned
    years_experience = Column(Integer, nullable=True, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    assessment = relationship("Assessment", back_populates="candidates")
    session = relationship("TestSession", back_populates="candidate", uselist=False)


class TestSession(Base):
    __tablename__ = "test_sessions"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), unique=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    score = Column(Integer, nullable=True)
    total = Column(Integer, nullable=True)
    tab_switches = Column(Integer, default=0)
    question_order = Column(Text, nullable=True)  # JSON list of MCQ IDs
    is_submitted = Column(Boolean, default=False)
    tab_switch_log = Column(Text, nullable=True)  # JSON list of {time, count} events

    candidate = relationship("Candidate", back_populates="session")
    answers = relationship("Answer", back_populates="session")


class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("test_sessions.id"))
    mcq_id = Column(Integer, ForeignKey("mcqs.id"))
    selected_option = Column(String, nullable=True)  # 'a', 'b', 'c', 'd' or None

    session = relationship("TestSession", back_populates="answers")
    mcq = relationship("MCQ", back_populates="answers")
