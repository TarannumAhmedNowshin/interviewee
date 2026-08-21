from datetime import datetime, timezone

from sqlalchemy import select

from app.db.models import InterviewSession, Turn
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
