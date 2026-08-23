from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, update

from app.db.models import (
    ArenaReview,
    ArenaSubmission,
    BehavioralSession,
    BehavioralTurn,
    InterviewSession,
    MockSession,
    MockTurn,
    PrepPlan,
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
            row.ended_at = datetime.now(UTC)
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
            rev.due_at = datetime.now(UTC) + timedelta(days=rev.interval_days)
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
            row.ended_at = datetime.now(UTC)
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


async def create_behavioral_session(
    session_id: str, question_id: str, question_title: str, category: str
) -> None:
    async with async_session() as db:
        if await db.get(BehavioralSession, session_id):
            return
        db.add(
            BehavioralSession(
                id=session_id,
                question_id=question_id,
                question_title=question_title,
                category=category,
            )
        )
        await db.commit()


async def add_behavioral_turn(
    session_id: str,
    idx: int,
    role: str,
    text: str,
    stage: str | None = None,
    move: str | None = None,
) -> None:
    async with async_session() as db:
        db.add(
            BehavioralTurn(
                session_id=session_id, idx=idx, role=role, text=text, stage=stage, move=move
            )
        )
        await db.commit()


async def save_behavioral_report(session_id: str, report: dict) -> None:
    async with async_session() as db:
        row = await db.get(BehavioralSession, session_id)
        if row:
            row.report = report
            row.status = "ended"
            row.ended_at = datetime.now(UTC)
            await db.commit()


async def list_behavioral_sessions(limit: int = 50) -> list[dict]:
    async with async_session() as db:
        rows = (
            (
                await db.execute(
                    select(BehavioralSession)
                    .order_by(BehavioralSession.started_at.desc())
                    .limit(limit)
                )
            )
            .scalars()
            .all()
        )
        return [
            {
                "id": r.id,
                "question_id": r.question_id,
                "question_title": r.question_title,
                "category": r.category,
                "status": r.status,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "ended_at": r.ended_at.isoformat() if r.ended_at else None,
                "overall_score": (r.report or {}).get("overall_score"),
            }
            for r in rows
        ]


async def get_behavioral_session(session_id: str) -> dict | None:
    async with async_session() as db:
        row = await db.get(BehavioralSession, session_id)
        if not row:
            return None
        turns = (
            (
                await db.execute(
                    select(BehavioralTurn)
                    .where(BehavioralTurn.session_id == session_id)
                    .order_by(BehavioralTurn.idx)
                )
            )
            .scalars()
            .all()
        )
        return {
            "id": row.id,
            "question_id": row.question_id,
            "question_title": row.question_title,
            "category": row.category,
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
        now = datetime.now(UTC)
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


async def create_prep_plan(
    plan_id: str, title: str, target_role: str, jd: str, cv: str, plan: dict
) -> None:
    async with async_session() as db:
        if await db.get(PrepPlan, plan_id):
            return
        db.add(
            PrepPlan(id=plan_id, title=title, target_role=target_role, jd=jd, cv=cv, plan=plan)
        )
        await db.commit()


async def list_prep_plans(limit: int = 50) -> list[dict]:
    async with async_session() as db:
        rows = (
            (await db.execute(select(PrepPlan).order_by(PrepPlan.created_at.desc()).limit(limit)))
            .scalars()
            .all()
        )
        return [
            {
                "id": r.id,
                "title": r.title,
                "target_role": r.target_role,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]


async def get_prep_plan(plan_id: str) -> dict | None:
    async with async_session() as db:
        row = await db.get(PrepPlan, plan_id)
        if not row:
            return None
        return {
            "id": row.id,
            "title": row.title,
            "target_role": row.target_role,
            "plan": row.plan,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }


async def expire_stale_sessions(older_than_hours: int = 24) -> int:
    """Flip long-abandoned 'active' sessions to 'expired' so history isn't full of zombies.

    A session only becomes 'ended' when the user explicitly finishes; a refreshed or
    closed tab otherwise leaves a perpetual 'active' row. This sweep (run on startup)
    retires ones older than the cutoff. 'expired' is distinct from 'ended' so it stays
    honest about what happened, and it is treated as non-resumable on rehydrate.
    """
    cutoff = datetime.now(UTC) - timedelta(hours=older_than_hours)
    now = datetime.now(UTC)
    total = 0
    async with async_session() as db:
        for model in (InterviewSession, MockSession, BehavioralSession):
            result = await db.execute(
                update(model)
                .where(model.status == "active", model.started_at < cutoff)
                .values(status="expired", ended_at=now)
            )
            total += result.rowcount or 0
        await db.commit()
    return total
