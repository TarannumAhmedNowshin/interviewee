# Start

## Backend (http://127.0.0.1:8000)

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

## Frontend (http://localhost:3000)

```powershell
cd frontend
npm.cmd run dev
```

## Docker services — optional (Postgres 5433, Piston 2000)

```powershell
docker compose up -d
```
