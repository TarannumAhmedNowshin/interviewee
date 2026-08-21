"""Behavioral Voice Round (Pillar 4): curated question bank.

Classic behavioral / leadership-principle style prompts. Each is intentionally
open-ended so the interviewer can probe for a full STAR (Situation, Task,
Action, Result) answer over voice.
"""

QUESTIONS: list[dict] = [
    {
        "id": "conflict",
        "title": "Team Conflict",
        "category": "Collaboration",
        "tags": ["Conflict", "Communication"],
        "prompt": (
            "Tell me about a time you had a significant disagreement with a coworker or "
            "teammate. What was the situation, how did you handle it, and how did it turn out?"
        ),
    },
    {
        "id": "failure",
        "title": "A Project That Failed",
        "category": "Ownership",
        "tags": ["Failure", "Learning"],
        "prompt": (
            "Describe a time a project failed or you made a significant mistake. What "
            "happened, what did you do about it, and what did you learn?"
        ),
    },
    {
        "id": "leadership",
        "title": "Leading Without a Title",
        "category": "Leadership",
        "tags": ["Leadership", "Influence"],
        "prompt": (
            "Tell me about a time you led a project or drove an initiative — especially "
            "without formal authority. How did you get people on board?"
        ),
    },
    {
        "id": "ambiguity",
        "title": "Deciding Under Ambiguity",
        "category": "Judgment",
        "tags": ["Ambiguity", "Decision-making"],
        "prompt": (
            "Describe a situation where you had to make an important decision with "
            "incomplete information. How did you approach it?"
        ),
    },
    {
        "id": "challenge",
        "title": "Hardest Technical Problem",
        "category": "Technical Depth",
        "tags": ["Problem-solving", "Depth"],
        "prompt": (
            "Walk me through the most technically challenging problem you've solved. What "
            "made it hard, and how did you crack it?"
        ),
    },
    {
        "id": "feedback",
        "title": "Difficult Feedback",
        "category": "Growth",
        "tags": ["Feedback", "Self-awareness"],
        "prompt": (
            "Tell me about a time you received difficult or critical feedback. How did you "
            "react, and what changed afterward?"
        ),
    },
    {
        "id": "deadline",
        "title": "Delivering Under Pressure",
        "category": "Execution",
        "tags": ["Pressure", "Prioritization"],
        "prompt": (
            "Describe a time you had to deliver something important under a tight deadline "
            "or intense pressure. How did you prioritize and get it done?"
        ),
    },
    {
        "id": "customer",
        "title": "Going Beyond for a User",
        "category": "Customer Focus",
        "tags": ["Customer", "Initiative"],
        "prompt": (
            "Tell me about a time you went out of your way to solve a problem for a customer "
            "or end user. What did you do, and what was the impact?"
        ),
    },
]

_BY_ID = {q["id"]: q for q in QUESTIONS}


def public_summary() -> list[dict]:
    """List view — no need to send the full prompt text is fine, it's short."""
    return [
        {
            "id": q["id"],
            "title": q["title"],
            "category": q["category"],
            "tags": q["tags"],
        }
        for q in QUESTIONS
    ]


def get(question_id: str) -> dict | None:
    return _BY_ID.get(question_id)
