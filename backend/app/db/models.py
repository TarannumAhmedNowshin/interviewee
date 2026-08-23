from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class InterviewSession(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    problem: Mapped[str] = mapped_column(Text)
    stage: Mapped[str] = mapped_column(String, default="intro")
    status: Mapped[str] = mapped_column(String, default="active")  # active | ended
    diagram: Mapped[str | None] = mapped_column(Text, nullable=True)  # whiteboard PNG b64
    report: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    turns: Mapped[list["Turn"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="Turn.idx"
    )


class Turn(Base):
    __tablename__ = "turns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), index=True
    )
    idx: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(String)  # user | assistant
    text: Mapped[str] = mapped_column(Text)
    stage: Mapped[str | None] = mapped_column(String, nullable=True)
    move: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["InterviewSession"] = relationship(back_populates="turns")


class ArenaSubmission(Base):
    __tablename__ = "arena_submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    problem_id: Mapped[str] = mapped_column(String, index=True)
    language: Mapped[str] = mapped_column(String)
    passed: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    solved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ArenaReview(Base):
    __tablename__ = "arena_reviews"

    problem_id: Mapped[str] = mapped_column(String, primary_key=True)
    reps: Mapped[int] = mapped_column(Integer, default=0)
    interval_days: Mapped[int] = mapped_column(Integer, default=0)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    solved: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class MockSession(Base):
    """A Live Mock Coding Interview (Pillar 3): bare editor + AI interviewer watching."""

    __tablename__ = "mock_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    problem_id: Mapped[str] = mapped_column(String)
    problem_title: Mapped[str] = mapped_column(String)
    language: Mapped[str] = mapped_column(String, default="python")
    code: Mapped[str | None] = mapped_column(Text, nullable=True)  # final editor contents
    status: Mapped[str] = mapped_column(String, default="active")  # active | ended
    report: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    turns: Mapped[list["MockTurn"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="MockTurn.idx"
    )


class MockTurn(Base):
    __tablename__ = "mock_turns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("mock_sessions.id", ondelete="CASCADE"), index=True
    )
    idx: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(String)  # user | assistant
    text: Mapped[str] = mapped_column(Text)
    stage: Mapped[str | None] = mapped_column(String, nullable=True)
    move: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["MockSession"] = relationship(back_populates="turns")


class BehavioralSession(Base):
    """A Behavioral Voice Round (Pillar 4): spoken STAR-method Q&A."""

    __tablename__ = "behavioral_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    question_id: Mapped[str] = mapped_column(String)
    question_title: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="active")  # active | ended
    report: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    turns: Mapped[list["BehavioralTurn"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="BehavioralTurn.idx"
    )


class BehavioralTurn(Base):
    __tablename__ = "behavioral_turns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("behavioral_sessions.id", ondelete="CASCADE"), index=True
    )
    idx: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(String)  # user | assistant
    text: Mapped[str] = mapped_column(Text)
    stage: Mapped[str | None] = mapped_column(String, nullable=True)
    move: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["BehavioralSession"] = relationship(back_populates="turns")


class PrepPlan(Base):
    """A personalized prep plan (Point 0): JD + CV -> a curated cross-pillar syllabus."""

    __tablename__ = "prep_plans"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, default="")
    target_role: Mapped[str] = mapped_column(String, default="")
    jd: Mapped[str] = mapped_column(Text)  # source job description
    cv: Mapped[str] = mapped_column(Text)  # source CV / resume
    plan: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # validated plan JSON
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
