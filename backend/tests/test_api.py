"""API smoke tests — pure endpoints that need no LLM, DB, or sandbox.

Run from the backend/ directory:  python -m pytest
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_ok():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_health_reports_services():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    for key in ("gpt5", "gpt5_mini", "whisper", "speech", "embeddings"):
        assert key in body["services"]


def test_arena_problem_list_and_detail():
    r = client.get("/arena/problems")
    assert r.status_code == 200
    problems = r.json()
    assert len(problems) >= 1
    first = problems[0]["id"]
    detail = client.get(f"/arena/problems/{first}")
    assert detail.status_code == 200
    assert detail.json()["id"] == first


def test_arena_problem_missing_is_404():
    assert client.get("/arena/problems/definitely-not-a-real-id").status_code == 404


def test_mock_problem_list_and_detail():
    r = client.get("/mock/problems")
    assert r.status_code == 200
    problems = r.json()
    assert len(problems) >= 1
    detail = client.get(f"/mock/problems/{problems[0]['id']}")
    assert detail.status_code == 200
    assert "starter" in detail.json()


def test_mock_problem_missing_is_404():
    assert client.get("/mock/problems/nope").status_code == 404


def test_behavioral_question_list_and_detail():
    r = client.get("/behavioral/questions")
    assert r.status_code == 200
    questions = r.json()
    assert len(questions) == 8
    detail = client.get("/behavioral/questions/conflict")
    assert detail.status_code == 200
    assert detail.json()["title"] == "Team Conflict"


def test_behavioral_question_missing_is_404():
    assert client.get("/behavioral/questions/nope").status_code == 404
