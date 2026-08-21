from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.db.models import (
    ArenaReview,
    ArenaSubmission,
    InterviewSession,
    MockSession,
    MockTurn,
    Turn,
)
from app.db.session import async_session


async def create_session(session_id: str, problem: str) -> None:
    async with async_session() as db:
        if await db.get(InterviewSession, session_id):
            return
        db.add(InterviewSession(id=session_id, problem=problem))
        await db.commit()


async def add_turn(
    session_id: str,
    idx: int,
    role: str,
    text: str,
    stage: str | None = None,
    move: str | None = None,
) -> None:
    async with async_session() as db:
        db.add(Turn(session_id=session_id, idx=idx, role=role, text=text, stage=stage, move=move))
        await db.commit()


async def update_diagram(session_id: str, diagram: str | None) -> None:
    async with async_session() as db:
        row = await db.get(InterviewSession, session_id)
        if row:
            row.diagram = diagram
            await db.commit()


async def save_report(session_id: str, report: dict, stage: str) -> None:
    async with async_session() as db:
        row = await db.get(InterviewSession, session_id)
        if row:
            row.report = report
            row.status = "ended"
            row.stage = stage
            row.ended_at = datetime.now(timezone.utc)
            await db.commit()


async def list_sessions(limit: int = 50) -> list[dict]:
    async with async_session() as db:
        rows = (
            (
                await db.execute(
                    select(InterviewSession)
                    .order_by(InterviewSession.started_at.desc())
                    .limit(limit)
                )
            )
            .scalars()
            .all()
        )
        return [
            {
                "id": r.id,
                "problem": r.problem,
                "status": r.status,
                "stage": r.stage,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "ended_at": r.ended_at.isoformat() if r.ended_at else None,
                "overall_score": (r.report or {}).get("overall_score"),
            }
            for r in rows
        ]


async def get_session(session_id: str) -> dict | None:
    async with async_session() as db:
        row = await db.get(InterviewSession, session_id)
        if not row:
            return None
        turns = (
            (await db.execute(select(Turn).where(Turn.session_id == session_id).order_by(Turn.idx)))
            .scalars()
            .all()
        )
        return {
            "id": row.id,
            "problem": row.problem,
            "status": row.status,
            "stage": row.stage,
            "diagram": row.diagram,
            "report": row.report,
            "started_at": row.started_at.isoformat() if row.started_at else None,
            "ended_at": row.ended_at.isoformat() if row.ended_at else None,
            "turns": [
                {"idx": t.idx, "role": t.role, "text": t.text, "stage": t.stage, "move": t.move}
                for t in turns
            ],
        }


# Spaced-repetition intervals (days) indexed by successful-solve count.
_REVIEW_INTERVALS_DAYS = [1, 3, 7, 16, 35]


async def save_arena_submission(
    problem_id: str, language: str, passed: int, total: int, solved: bool
) -> None:
    async with async_session() as db:
        db.add(
            ArenaSubmission(
                problem_id=problem_id,
                language=language,
                passed=passed,
                total=total,
                solved=solved,
            )
        )
        if solved:
            rev = await db.get(ArenaReview, problem_id)
            if rev is None:
                rev = ArenaReview(problem_id=problem_id)
                db.add(rev)
            rev.solved = True
            rev.reps = (rev.reps or 0) + 1
            rev.interval_days = _REVIEW_INTERVALS_DAYS[
                min(rev.reps - 1, len(_REVIEW_INTERVALS_DAYS) - 1)
            ]
            rev.due_at = datetime.now(timezone.utc) + timedelta(days=rev.interval_days)
        await db.commit()


async def create_mock_session(
    session_id: str, problem_id: str, problem_title: str, language: str
) -> None:
    async with async_session() as db:
        if await db.get(MockSession, session_id):
            return
        db.add(
            MockSession(
                id=session_id,
                problem_id=problem_id,
                problem_title=problem_title,
                language=language,
            )
        )
        await db.commit()


async def add_mock_turn(
    session_id: str,
    idx: int,
    role: str,
    text: str,
    stage: str | None = None,
    move: str | None = None,
) -> None:
    async with async_session() as db:
        db.add(
            MockTurn(session_id=session_id, idx=idx, role=role, text=text, stage=stage, move=move)
        )
        await db.commit()


async def update_mock_code(session_id: str, language: str, code: str | None) -> None:
    async with async_session() as db:
        row = await db.get(MockSession, session_id)
        if row:
            row.language = language
            row.code = code
            await db.commit()


async def save_mock_report(session_id: str, report: dict) -> None:
    async with async_session() as db:
        row = await db.get(MockSession, session_id)
        if row:
            row.report = report
            row.status = "ended"
            row.ended_at = datetime.now(timezone.utc)
            await db.commit()


async def list_mock_sessions(limit: int = 50) -> list[dict]:
    async with async_session() as db:
        rows = (
            (
                await db.execute(
                    select(MockSession).order_by(MockSession.started_at.desc()).limit(limit)
                )
            )
            .scalars()
            .all()
        )
        return [
            {
                "id": r.id,
                "problem_id": r.problem_id,
                "problem_title": r.problem_title,
                "language": r.language,
                "status": r.status,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "ended_at": r.ended_at.isoformat() if r.ended_at else None,
                "overall_score": (r.report or {}).get("overall_score"),
            }
            for r in rows
        ]


async def get_mock_session(session_id: str) -> dict | None:
    async with async_session() as db:
        row = await db.get(MockSession, session_id)
        if not row:
            return None
        turns = (
            (
                await db.execute(
                    select(MockTurn).where(MockTurn.session_id == session_id).order_by(MockTurn.idx)
                )
            )
            .scalars()
            .all()
        )
        return {
            "id": row.id,
            "problem_id": row.problem_id,
            "problem_title": row.problem_title,
            "language": row.language,
            "code": row.code,
            "status": row.status,
            "report": row.report,
            "started_at": row.started_at.isoformat() if row.started_at else None,
            "ended_at": row.ended_at.isoformat() if row.ended_at else None,
            "turns": [
                {"idx": t.idx, "role": t.role, "text": t.text, "stage": t.stage, "move": t.move}
                for t in turns
            ],
        }


async def get_arena_progress() -> dict:
    async with async_session() as db:
        sub_rows = (
            await db.execute(
                select(
                    ArenaSubmission.problem_id,
                    func.count().label("attempts"),
                ).group_by(ArenaSubmission.problem_id)
            )
        ).all()
        reviews = (await db.execute(select(ArenaReview))).scalars().all()
        now = datetime.now(timezone.utc)
        out: dict[str, dict] = {
            r.problem_id: {"attempts": r.attempts, "solved": False, "due": False, "due_at": None}
            for r in sub_rows
        }
        for rev in reviews:
            entry = out.setdefault(
                rev.problem_id,
                {"attempts": 0, "solved": False, "due": False, "due_at": None},
            )
            entry["solved"] = rev.solved
            entry["due"] = bool(rev.due_at and rev.due_at <= now)
            entry["due_at"] = rev.due_at.isoformat() if rev.due_at else None
        return out
