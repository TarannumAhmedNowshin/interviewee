# Interviewwee — AI Interview Practice Platform

> **Living plan / single source of truth.** Update **Status**, **What's Next**, and the
> **Changelog** every work session so we always keep full context.

---

## Status / What's Next

- **Phase:** **All three pillars browser-verified end-to-end + interview-robustness pass DONE.** Arena (Run/Submit vs Piston + gpt-5 review), System Design voice room (stage machine + rubric debrief), and Live Mock Coding (Pillar 3) all tested like a real user. Hardened the live-interview edge cases: WebSocket **auto-reconnect** (guarded send, capped backoff, same-session resume, "reconnecting" banner, no stuck spinner), room fetch-error states, friendly panic-end report, and a History error state. See the 2026-08-22 changelog entry.
- **Next action:** **Behavioral Voice Round** (Pillar 4, STAR-method voice Q&A; reuses voice + scoring) — or **P7 polish/deploy** (README + architecture diagram + live URL).
- **Watch-outs:** (1) Whisper 3 RPM. (2) Postgres on **port 5433**. (3) Piston needs `NODE_TLS_REJECT_UNAUTHORIZED=0` (dev-only) for its GitHub runtime downloads behind corporate TLS. (4) Piston max `run_timeout`=3000ms. (5) PowerShell is in **ConstrainedLanguage mode** — no .NET method calls (`.Substring`, `[Math]`) in terminal commands. (6) Monaco has no `.inputarea` in this build — automate code entry via `window.monaco.editor.getModels()[0].setValue(...)`. (7) In-memory interview sessions: a network blip auto-resumes seamlessly, but a full **backend restart** mid-interview loses live context (fresh session) — fine for dev.

---

## Decisions (locked)

| Area | Decision |
|---|---|
| Product name | **Interviewwee** |
| MVP scope | One pillar, built deep: **System Design Voice Room** |
| Goal | Both — portfolio-grade now, architected to grow into a real product |
| Frontend | Next.js + TypeScript + Tailwind |
| Backend | Python **FastAPI** |
| Cloud | **Azure** |
| LLM (interviewer brain + vision) | **gpt-5** for reasoning + vision; **gpt-5-mini** for cheap moves (Azure OpenAI) |
| Voice architecture | **Modular pipeline (Option B)**, providers pluggable: Whisper (STT) → gpt-5 (+vision) → Azure AI Speech (TTS) |
| TTS voice | Azure AI Speech **Free tier (F0)** neural — `en-US-Ava:DragonHDLatestNeural` (F) / `en-US-Andrew:DragonHDLatestNeural` (M) |
| Database | Local **Postgres** (Docker) + pgvector |
| Recording / observability | **On from day 1** — transcripts, per-turn STT/LLM/TTS latencies, saved audio, live debug panel (also the future playback feature) |
| Deferred | Auth/billing/multi-tenant, code-exec sandbox, Pillars 1/3/4, RAG bank, cloud deploy |

---

## Full product vision

Four practice "arenas" with an AI interviewer at the center. The product itself demonstrates senior AI-engineering skill: real-time voice, agentic orchestration, multimodal vision, evals, and RAG.

- **Pillar 1 — Coding Arena:** LeetCode-style, multi-language (Python, SQL, C, C++, JS), Monaco editor, real execution vs. hidden tests. AI: non-spoiler hints, post-submit review, Big-O analysis, "explain your approach" critique.
- **Pillar 2 — System Design Voice Room (MVP):** real-time two-way voice interview + shared diagram canvas the AI can *see* (gpt-4o vision). Ends with a scored feedback report.
- **Pillar 3 — Live Mock Coding Interview:** timed, **bare editor** (no autocomplete/syntax/squiggles), AI watches and asks follow-ups, scores approach + communication + time management.
- **Pillar 4 — Behavioral Voice Round:** STAR-method voice Q&A; feedback on structure, filler words, pacing, and impact.

**Cross-cutting features:** AI scoring rubric + debrief after every session; résumé + job-description personalization; progress analytics + spaced repetition; session recording + playback; company-flavored question banks (FAANG vs. startup).

---

## MVP deep dive — System Design Voice Room

### Realistic interview behavior

Grounded in how real interviews are run (Hello Interview delivery framework + interviewing.io senior guide). The AI behaves like a human interviewer — sometimes it asks you to draw, sometimes it probes, sometimes it asks about your own projects — via a **stage model** plus a per-turn **move policy**.

**Stages** (timings for a ~35–45 min session; scaled to session length):

0. **Intro & vague prompt** (~1–2 min) — greet, pose an intentionally under-specified problem ("Design a photo-sharing service"), set expectations.
1. **Requirements** (~5 min) — functional ("users should be able to…") + non-functional (scalability, latency, availability, CAP/consistency, durability, security, fault tolerance, compliance). Answer clarifying questions; deliberately withhold some detail to see if the candidate asks.
2. **(Optional) Capacity estimation** (~2 min) — only if it influences the design.
3. **Core entities + API/interface** (~5 min) — entity list + REST/GraphQL/RPC contract.
4. **High-level design** (~10–15 min) — **prompt the candidate to draw** boxes/arrows on the canvas; read the diagram via vision and reference it.
5. **Deep dives** (~10 min) — probe bottlenecks, trade-offs, change requirements ("now 10× traffic / a region fails"), ask "why X not Y".
6. **Wrap-up** (~2 min) — ask the candidate to summarize; ask about their own related experience/projects.

**Move set** (policy picks one per turn from stage + candidate answer + diagram + time budget):
`answer_clarification`, `probe_deeper`, `request_diagram`, `challenge_tradeoff`, `inject_constraint`, `ask_about_experience`, `give_hint`, `redirect`, `advance_stage`, `wrap_up`.

**Adaptivity:** seniority-aware (drives less for senior, expects them to lead), vision-informed (references the actual diagram), time-aware (phase clock), configurable persona/difficulty, company-style later. This agent policy + phase machine + time budget is the senior-AI-eng showcase (not a plain chatbot).

**Principles baked into the system prompt:** no single "right" answer — reward well-reasoned trade-offs and push the candidate to *decide*; prefer generic component names over brand names unless justified (if they name-drop Kafka/Cassandra, ask "why that vs. the alternative?"); collaborative tone; hint when stuck/silent; steer when off-track; anchor decisions to end-user experience.

### Voice pipeline architecture (modular, pluggable)

```
Browser mic (AudioWorklet, PCM16 16 kHz mono)
  → WebSocket /ws/interview/{session_id}   (binary audio frames + JSON control events)
  → VAD / endpointing                      (silero-vad preferred; webrtcvad fallback)
  → STT provider                           (Whisper on Azure OpenAI; swappable to Azure Speech streaming)
  → Orchestrator                           (state machine: IDLE → LISTENING → THINKING → SPEAKING → (barge-in) → LISTENING;
                                            stage model + move policy + time budget)
  → LLM provider                           (Azure OpenAI gpt-4o, streaming; persona + stage + history + periodic diagram image)
  → TTS provider                           (Azure AI Speech, streaming HD neural voice)
  → WebSocket audio back → browser playback (AudioWorklet)
```

- **Barge-in:** user speech during `SPEAKING` → stop playback, cancel in-flight LLM + TTS, return to `LISTENING`.
- **Diagram vision:** Excalidraw canvas → `exportToBlob` PNG (debounced / on-demand when the candidate says "take a look" or `move == request_diagram`) → attached to the gpt-4o vision turn. **Not** every turn (cost/latency).
- **Feedback:** on end → separate gpt-4o structured-output (JSON schema) call over transcript + final diagram → rubric scores + narrative + strengths + improvements.

### Observability / recording (from day 1)

- Persist every turn: role, text, chosen move, stage, STT/LLM/TTS latency, tokens.
- Save audio blobs (user utterance + AI reply) to local disk/volume (Azure Blob later).
- Structured JSON logging + a live **debug panel** in the room UI (transcript, current stage, current move, latencies).
- Doubles as the session recording + playback feature later.

### Data model (Postgres + pgvector)

- `prompts(id, title, statement, functional_reqs, nonfunctional_reqs, rubric_json, difficulty, tags, company_style)`
- `interview_sessions(id, prompt_id, status, stage, started_at, ended_at, score_json, config_json)`
- `turns(id, session_id, idx, role, text, move, stage, audio_path, stt_ms, llm_ms, tts_ms, tokens, ts)`
- `diagram_snapshots(id, session_id, turn_idx, image_path, ts)`
- *(later)* `users`, embeddings (pgvector) for the RAG prompt bank.

### Repo layout (monorepo)

```
interviewwee/
  plan.md                      ← this living plan
  README.md  .env.example  .gitignore
  docker-compose.yml           ← postgres + pgvector (dev)
  backend/
    app/
      main.py                  ← FastAPI app, /health, REST, WS /ws/interview/{id}
      config.py                ← pydantic-settings from .env
      orchestrator.py          ← turn state machine + stage model + move policy + time budget
      interviewer.py           ← persona/system-prompt builder, move selection
      services/
        stt.py                 ← WhisperSTT + base STTProvider
        llm.py                 ← AzureChatLLM + vision helper
        tts.py                 ← AzureSpeechTTS + base TTSProvider
        vad.py                 ← SileroVAD / WebrtcVAD
        scoring.py             ← structured rubric feedback
      db/                      ← models.py, session.py, alembic migrations
      audio/                   ← framing + format conversion helpers
    pyproject.toml / requirements.txt, ruff config, tests/
  frontend/
    app/
      page.tsx                 ← home / dashboard
      room/[id]/page.tsx       ← interview room
      feedback/[id]/page.tsx   ← report
    components/                ← Canvas (Excalidraw), Transcript, MicController, DebugPanel, VoiceOrb
    lib/                       ← ws client, audio worklet, store (zustand)
    tailwind config, eslint
```

### Key libraries

- **Backend:** fastapi, uvicorn[standard], websockets, openai (Azure), azure-cognitiveservices-speech, silero-vad (torch) / webrtcvad, pydantic-settings, sqlalchemy, asyncpg, pgvector, alembic, httpx, structlog.
- **Frontend:** next, react, typescript, tailwindcss, @excalidraw/excalidraw, zustand.

### Environment variables (`.env`)

```dotenv
# LLM — interviewer brain + vision
AZURE_GPT5_ENDPOINT=...   AZURE_GPT5_API_KEY=...   AZURE_GPT5_DEPLOYMENT=gpt-5
AZURE_GPT5_API_VERSION=2024-12-01-preview
# Cheap moves
AZURE_GPT5_MINI_ENDPOINT=...   AZURE_GPT5_MINI_API_KEY=...   AZURE_GPT5_MINI_DEPLOYMENT=gpt-5-mini
# STT (Whisper) — TODO: only WHISPER_KEY set; still need endpoint + deployment + api-version
WHISPER_KEY=...   WHISPER_ENDPOINT=?   WHISPER_DEPLOYMENT=?   WHISPER_API_VERSION=?
# Embeddings (RAG, later)
AZURE_OPENAI_EMBED_ENDPOINT=...   AZURE_OPENAI_EMBED_API_KEY=...   AZURE_OPENAI_EMBED_DEPLOYMENT=text-embedding-3-large   AZURE_OPENAI_EMBED_DIMENSIONS=3072
# TTS (Azure AI Speech, Free F0)
AZURE_SPEECH_KEY=...   AZURE_SPEECH_REGION=eastus   AZURE_SPEECH_VOICE=en-US-Ava:DragonHDLatestNeural
# DB
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/interviewwee
```

### Azure AI Speech — how to get it

- It's the **Azure AI Speech** service (Cognitive Services "Speech"). TTS uses a neural **voice** picked at call time — not an OpenAI-style deployment.
- **Create:** portal.azure.com → Create resource → search **"Speech"** → pick a region (e.g., East US) → Create → **Go to resource → Keys and Endpoint** → copy **KEY** + **REGION**.
- **Python:** `pip install azure-cognitiveservices-speech`; `SpeechConfig(subscription=KEY, region=REGION)`; set `speech_config.speech_synthesis_voice_name = AZURE_SPEECH_VOICE`.
- **Recommended interviewer voice:** HD neural — `en-US-Ava:DragonHDLatestNeural` / `en-US-Andrew:DragonHDLatestNeural` (most human). Standard alternatives: `en-US-JennyNeural` / `en-US-AndrewNeural`. Preview in the [Voice Gallery](https://speech.microsoft.com/portal/voicegallery).
- **Streaming:** the SDK supports real-time streaming synthesis (Synthesizing events / AudioDataStream) and raw PCM output (e.g. `Raw16Khz16BitMonoPcm`) for low-latency browser playback.
- The same Speech resource also does streaming **STT** if we later swap Whisper.

---

## Phases

Each phase is independently verifiable. Recording/observability is threaded throughout.

| # | Phase | Depends on | Deliverable | Verify |
|---|---|---|---|---|
| **P0** | Scaffold & infra | — | Monorepo, FE+BE skeletons, Docker Postgres+pgvector, `.env` wiring, `/health`, lint, `plan.md` at root | Both apps boot; `/health` ok; DB up; lint passes |
| **P1** | Interview brain (text) | P0 | gpt-4o interviewer with **stage model + move policy** over WebSocket, streamed replies, turn persistence, debug panel | Type → streamed reply that follows stages & picks sensible moves; turns saved |
| **P2** | Voice out (TTS) | P1 | Stream replies through Azure AI Speech HD voice → browser | Replies spoken, streamed, low lag |
| **P3** | Voice in (STT + VAD) | P2 | Mic (AudioWorklet) → silero VAD → Whisper → loop; save audio | Speak → accurate transcript → voice reply (full two-way) |
| **P4** | Barge-in & turn-taking | P3 | Interrupt handling, cancel in-flight LLM/TTS, latency tuning (<~2 s) | Talk over the AI → it stops and listens within a beat |
| **P5** | Diagram canvas + vision | P3 (∥ P4) | Excalidraw; debounced/on-demand PNG → gpt-4o vision; `request_diagram` move | Draw "Load Balancer" → AI comments accurately; prompts drawing at stage 4 |
| **P6** | Feedback + report + replay | P1–P5 | Structured rubric (JSON schema) over transcript+diagram; feedback page; replay from records | End → scored report; replay works |
| **P7** | Polish & portfolio *(stretch)* | P6 | Editorial UI, ~8-prompt bank (JSON), README + architecture diagram, demo script, optional Azure deploy (Container Apps + Static Web Apps) | Demo runs end-to-end |

**End-to-end acceptance:** pick a prompt → voice-interview through all stages while sketching → barge-in works → AI references the diagram → end → scored report + audio replay.

---

## Risks / notes

- **Whisper is per-utterance** (not streaming) → adds latency; mitigate with good VAD endpointing; STT interface stays pluggable to swap Azure Speech streaming STT.
- **Real-time audio:** PCM16 16 kHz mono; AudioWorklet for capture + playback; define the WS protocol (binary audio frames + JSON events: `start` / `stop` / `partial` / `stage` / `move` / `interrupt`).
- **Barge-in** is the trickiest UX → its own phase (P4).
- **Cost control:** don't send the diagram every turn (debounce/on-demand); cap session length; use structured outputs for scoring; consider gpt-4o-mini for cheap moves.
- The vision path requires a **gpt-4o vision-capable** deployment.

---

## Future roadmap (post-MVP, in growth order)

1. Feedback depth + analytics dashboard + spaced repetition.
2. Résumé + job-description personalization.
3. Auth + user accounts (Entra External ID / Clerk / Supabase) → multi-user.
4. **Pillar 3** — Live Mock Coding (bare editor); reuses voice + scoring.
5. **Pillar 1** — Coding Arena (needs code-exec sandbox: Judge0 / Piston / Docker).
6. **Pillar 4** — Behavioral Voice; reuses voice + scoring.
7. RAG prompt bank (pgvector) + company-style banks.
8. Cloud deploy + billing.

---

## Changelog

- **2026-08-22** — **Full end-to-end QA + interview-robustness pass (browser-verified).** Tested all three pillars like a user and hardened the live-interview edge cases. **WebSocket resilience** (both `useInterview.ts` + `useMockInterview.ts`): `send()` now guards socket `readyState` and returns a bool (no more `InvalidStateError` throw on a non-OPEN socket); **auto-reconnect** with capped exponential backoff reusing a stable `sessionIdRef` (a network blip → backend `get_or_create` returns the same in-memory session → seamless continuation, transcript intact); on close the stuck "thinking"/"evaluating" states clear and a "Connection lost — reconnecting…" banner shows via the existing notice UI (cleared on reopen); superseded-socket guard prevents StrictMode double-mount from spawning orphaned reconnects; `sendUser`/`finish` return bool so rooms preserve the input box / don't lock on a failed send. **Room fetch-error states**: `arena/[id]` + `mock/[id]` show "Couldn't load this problem / ← Back" instead of an infinite "Loading…" on a bad id. **Panic-end**: `orchestrator.evaluate` + `mock_orchestrator.evaluate` short-circuit to a friendly, actionable 0/5 "you didn't engage" report (no wasted gpt-5 call) when there are no candidate turns. **History**: added a server-down error state (distinct from empty). Verified in-browser: Arena Run 3/3 + Submit 5/5 (Piston hidden tests) + gpt-5 review/Big-O; System Design intro→requirements with a 6-dimension rubric debrief (1.8/5); Mock panic-end friendly report; and a full kill-backend-mid-round → banner + cleared spinner + backoff → restart → auto-reconnect same session → banner cleared, transcript intact.
- **2026-08-21** — **Live Mock Coding Interview (Pillar 3) COMPLETE.** Backend: `mock_interviewer.py` (coding-interview stages/moves + interviewer/director/scoring prompts), `mock_orchestrator.py` (in-memory session with code + language + time-remaining; director sees the live code + clock; interviewer streams spoken replies watching the code as text), `mock_ws.py` (`/ws/mock/{id}`: start{problem_id,language}/code{code,language,seconds_left}/user_message/audio/interrupt/set_voice/finish/end — reuses TTS+STT+barge-in), `mock.py` (`/mock/problems`, `/mock/problems/{id}`, `/mock/sessions`, `/mock/sessions/{id}`; problems shared with the Arena bank). DB: `mock_sessions` + `mock_turns` (auto-created via create_all) + repo helpers. Frontend: `lib/mock.ts`, `lib/useMockInterview.ts` (WS + code push + voice), `/mock` lobby (problems + past rounds), `/mock/[id]` room (**bare Monaco** — suggestions/hover/validation off + JS/TS diagnostics disabled; 25-min countdown that auto-ends; voice + hands-free; transcript + stage/move ticker), `/mock/replay/[id]`. Nav wired across home/arena/history. Verified: `/mock/problems` + detail via TestClient (3 problems, starter py/js/cpp); backend imports + all routers registered; ruff clean on new files.
- **2026-08-21** — Coding Arena COMPLETE. Tiered non-spoiler hints (`/arena/hint`, 3 levels, gpt-5). Progress + spaced-repetition: `arena_submissions` + `arena_reviews` tables, `save_arena_submission` (advances SM-2-lite schedule on solve), `/arena/progress`; list page shows Solved/Review-due/Attempted badges + due count. Verified: hint (level-1 nudge) + progress persistence (two-sum solved, review due +1 day) against Azure/Postgres.
- **2026-08-21** — Coding Arena core. Self-hosted Piston (docker-compose, privileged, `NODE_TLS_REJECT_UNAUTHORIZED=0` for corporate TLS; runtimes python/gcc/node). `services/executor.py` (Piston client), `arena_problems.py` (3 pattern-tagged stdin/stdout problems), `arena.py` (grader + list/detail/run/submit + gpt-5 review). Frontend `/arena` list + `/arena/[id]` (Monaco + lang switch + Run/Submit + results/review panel). Fixed: Piston `run_timeout`≤3000ms; a bad test case. Verified Python+C++ 4/4 in-process and full flow in-browser.
- **2026-08-21** — Coding Arena (Pillar 2), backend + UI, browser-verified. Self-hosted **Piston** sandbox (docker-compose, privileged) running Python 3.12 / C / C++ (gcc 10.2) / Node 20; `services/executor.py` client. `arena_problems.py` = 3 pattern-tagged problems (Two Sum, Valid Parentheses, Max Subarray) with public+hidden stdin/stdout tests + starter (py/js/cpp). `arena.py` router: `/arena/problems`, `/problems/{id}`, `/run` (public), `/submit` (all tests + gpt-5 review). Frontend `/arena` list + `/arena/[id]` (Monaco + Run/Submit + results/review panel). Verified grading 4/4 (Python+C++) and full UI flow (Run tracebacks; Submit + accurate AI review). Dev workaround: `NODE_TLS_REJECT_UNAUTHORIZED=0` on Piston (corporate TLS inspection blocks runtime downloads); Piston max run_timeout 3000ms.
- **2026-08-21** — DB persistence + replay. Added SQLAlchemy async models (`sessions`, `turns` with stage/move, diagram, report JSON) + engine (`init_db` via FastAPI lifespan) + repo (list/get). WS flow persists best-effort (create session on connect, save each turn + diagram + final report) — DB failures never break a live interview. `/sessions` + `/sessions/{id}` endpoints. Frontend `/history` list + `/replay/[id]` (read-only transcript + whiteboard snapshot + `FeedbackReport`). Moved Postgres to **port 5433** (5432 owned by another project); fresh pgvector volume. Verified end-to-end in-browser (persisted session, score 3.5).
- **2026-08-21** — QA + polish pass (browser end-to-end). FIXED critical bug: `assistant_delta` mutated `streamingIdRef` inside the `setMessages` updater, so React StrictMode's double-invoke dropped every interviewer message in dev (empty interview). Updaters are now pure. Latency ~2x better via `reasoning_effort="minimal"` on the interviewer (opening ~5s, full turn ~8s). Cached Azure clients (llm/stt). Added user-visible STT/feedback error notices. Defensive `FeedbackReport` rendering. Fixed page metadata + pinned Turbopack root. Verified full flow in-browser.
- **2026-08-21** — P6: scored feedback report. Added `SCORING_SYSTEM` rubric + `llm.score_json` (gpt-5 JSON) + `orchestrator.evaluate` (grades transcript + final diagram). WS `finish` → `evaluating`/`feedback` events. Frontend: "End & get feedback" button + `FeedbackReport` overlay (overall score, 6 rubric bars, strengths/improvements). Verified valid rubric JSON from Azure (overall 2.8, 6 dims, 3 strengths).
- **2026-08-21** — P5: diagram canvas + vision. Added `@excalidraw/excalidraw` whiteboard (`components/Canvas.tsx`) as the room centerpiece; debounced PNG snapshots (scaled ≤1024px) stream over WS `diagram`. Backend stores `session.diagram`, tells the gpt-5-mini director whether the board is empty, and attaches the image to gpt-5 replies (`stream_reply` multimodal). Verified gpt-5 accepts image input ("I see a blank whiteboard…"). Note: httpx2 on Py3.14 emits harmless async-gen cleanup warnings on exit.
- **2026-08-21** — P4: continuous listening + barge-in. Backend turns now run as cancellable asyncio tasks with an `interrupt` handler (partial replies preserved in history). Frontend: hands-free "Listen" toggle using client-side energy VAD (AudioContext + AnalyserNode) that auto-segments utterances (endpointing) → Whisper; barge-in stops AI audio locally and cancels the server turn. Replaced push-to-talk. Verified normal turn + interrupt in-process.
- **2026-08-21** — P3: voice in. Added `services/stt.py` (Azure Whisper transcription; auto-maps the Foundry *project* endpoint → `…cognitiveservices.azure.com` for the OpenAI SDK). WS handles `audio` messages (base64 webm) → Whisper → `transcript` → interviewer replies. Frontend mic capture via MediaRecorder + "Speak/Stop" button. Validated via a TTS→Whisper round-trip.
- **2026-08-21** — P2: voice out. Added `services/tts.py` (Azure AI Speech REST, HD neural voice `en-US-Ava:DragonHDLatestNeural`, 24 kHz MP3). Interviewer replies are synthesized and streamed over the WebSocket as base64 `audio_chunk`; the frontend plays them via a sequential queue with a voice on/off toggle + speaking indicator (`set_voice` message). Verified isolated TTS (16.8 KB MP3) and full WS flow (82.8 KB MP3) against Azure F0.
- **2026-08-21** — P1: interview brain. Two-model design — gpt-5-mini **director** picks stage+move (JSON), gpt-5 **interviewer** streams the reply. WebSocket `/ws/interview/{id}` (events: session / state / assistant_delta / assistant_done). Frontend room UI (Next.js) with live transcript + interviewer console. Verified opening + director + reply end-to-end against Azure (in-process TestClient). Sessions in-memory (DB persistence deferred).
- **2026-08-21** — P0 scaffold: created `backend/` (FastAPI app, config from root `.env`, `/health`), `frontend/` (Next.js 16 + TS + Tailwind), `docker-compose.yml` (pgvector/pg16). Backend deps installed in a Python 3.14 venv; `/health` verified **ok** with all integrations configured. Added `websockets` to requirements; switched `uvicorn[standard]`→`uvicorn`.
- **2026-08-20** — Keys wired in `.env` (Azure OpenAI **gpt-5** + **gpt-5-mini**, embeddings, Whisper key, Azure Speech F0). LLM switched **gpt-4o → gpt-5 / gpt-5-mini**. TTS locked to **Azure Speech Free tier (F0)** neural. Added `.gitignore` to protect `.env`. TODO: Whisper endpoint + deployment name + api-version (only key present).
- **2026-08-20** — Plan created. Locked stack/voice/Azure decisions. Added researched realistic-interview behavior model (stage machine + move policy) and Azure AI Speech setup. Recording/observability enabled from day 1.
