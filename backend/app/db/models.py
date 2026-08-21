from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
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
    diagram: Mapped[str | None] = mapped_column(Text, nullable=True)  # latest whiteboard PNG (base64)
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
