 # Interviewwee — Backend (FastAPI)

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

```powershell
uvicorn app.main:app --reload --port 8000
```

- Root: http://localhost:8000/
- Health: http://localhost:8000/health  (reports which Azure integrations are configured)

## Lint

```powershell
ruff check .
```

Configuration is read from the repo-root `.env` (see `app/config.py`).
