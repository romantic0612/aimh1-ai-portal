# AIMH1 Project Notes

This file is the operating guide for future Codex work in this repository. Keep it readable, conservative, and up to date.

## Safety Rules

Do not bulk-delete files or directories.

Never use:

- `del /s`
- `rd /s`
- `rmdir /s`
- `Remove-Item -Recurse`
- `rm -rf`

If a file must be deleted, delete only one explicit path at a time, for example:

```powershell
Remove-Item "C:\path\to\file.txt"
```

If many files look removable, stop and produce a review list for the user. Do not delete the list automatically.

Never commit real secrets:

- `.env`
- database passwords
- CAS secrets
- API keys
- Dify keys
- MiniMax or OpenAI-compatible model keys

Do not repeat real secrets in replies.

## Project Shape

This is a packaged frontend plus Node/Express backend project.

- Static frontend output is in `dist/`.
- Frontend entry file is `dist/index.html`.
- Backend code is in `server/`.
- Backend entry file is `server/src/server.js`.
- Backend scripts are in `server/package.json`: `npm run dev` and `npm start`.
- Production can run with `ecosystem.config.cjs` and PM2 cluster mode.
- GitHub repository: `https://github.com/romantic0612/aimh1-ai-portal.git`.
- Production domain: `https://sjaigc.ahau.edu.cn/`.

## Production Setup

Production uses Docker plus PM2 cluster.

- PM2 app name: `aimh1-portal`
- PM2 mode: `exec_mode: "cluster"`
- PM2 instances: `10`
- Memory restart limit: `1G`
- Production port: `7998`

Deploy:

```bash
cd ~/aimh1-ai-portal
git pull origin main
docker compose up -d --build
curl http://127.0.0.1:7998/api/health
```

Expected health response:

```json
{"ok":true}
```

## Core Capabilities

The app is the Anhui Agricultural University AI portal.

Main capabilities:

- CAS/OAuth login, logout, and session lookup.
- Static frontend hosting with SPA fallback when `dist/` exists.
- Chat endpoint at `POST /api/chat/stream`, using SSE streaming.
- Chat history list, detail lookup, single delete, and clear all.
- Home and chat pages support three campus agents:
  - Jiaowu Agent: `agent_id=jiaowu`
  - AI Librarian: `agent_id=library`
  - AI Counselor: `agent_id=xg`
- If no campus agent is selected, chat uses the default general model.
- If a campus agent is selected, the request must go to that Dify agent. Do not auto-route away from the selected agent.
- Rankings endpoint: `GET /api/rankings`.
- Agent list endpoint: `GET /api/agents`.
- Feedback and join forms.
- Admin observability dashboard.

Important endpoints:

- `GET /api/health`
- `GET /api/auth/session`
- `GET /api/announcements`
- `GET /api/chat/history`
- `GET /api/chat/history/detail`
- `POST /api/chat/stream`
- `GET /api/rankings`
- `GET /api/agents`
- `POST /api/feedback`
- `POST /api/join`
- `GET /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/exchange`
- `GET /callback`

## Session And Database

Production uses MySQL-backed sessions so PM2 cluster instances share login state.

Important production env settings live in `server/.env` on the server:

```env
SESSION_STORE=mysql
MYSQL_POOL_SIZE=15
```

Session table:

```text
portal_sessions
```

Rules:

- Do not commit `server/.env`.
- Do not print or summarize secret values.
- Do not modify production database schema casually.

## Dify And General Model Routing

Routing lives mainly in:

- `server/src/server.js`
- `server/src/agentRouter.js`

Current chat routing:

```text
No selected button -> general default model
Jiaowu Agent selected -> agent_id=jiaowu
AI Librarian selected -> agent_id=library
AI Counselor selected -> agent_id=xg
```

The home page and chat page must follow the same routing rules.

Campus agent button behavior:

- Default state: none selected.
- Tap one button: select that agent.
- Tap the same selected button again: cancel selection and return to general model.
- History replay mode should not show the agent switcher.

Relevant Dify concurrency settings:

```env
DIFY_CONNECT_TIMEOUT=15
DIFY_READ_TIMEOUT=600
DIFY_MAX_CONCURRENT=10
```

Meaning:

- Each Node instance can call up to 10 Dify requests concurrently.
- With 10 PM2 instances, portal-side Dify concurrency is about 100.

## Frontend Asset Rules

The frontend currently has packaged output only. There is no reliable source build step in active use.

Before changing frontend assets:

1. Read the current `dist/index.html`.
2. Create a new dated and sequenced JS/CSS file.
3. Update `dist/index.html` to reference the new file.
4. Do not overwrite old versioned assets directly.
5. Do not bulk-delete old assets.
6. Do not casually change the top brand image paths.

Example versioned files:

```text
index-chat-agent-switch-20260527a.js
index-chat-agent-switch-20260527a.css
mobile-realphone-final-20260528j.css
```

## Asset Cleanup Policy

`dist/assets` now contains many versioned JS/CSS files. Cleanup must be treated as a separate audit task.

Allowed first steps:

1. Read `dist/index.html`.
2. List all JS/CSS files directly referenced by `dist/index.html`.
3. List all JS/CSS files in `dist/assets`.
4. Search the repo for references to each candidate asset.
5. Produce a table with these groups:
   - `active`: directly referenced by `dist/index.html`; do not delete.
   - `referenced`: referenced by another asset or file; do not delete without deeper review.
   - `candidate_unused`: no reference found; still do not delete without user confirmation.

Forbidden cleanup behavior:

- Do not delete by wildcard.
- Do not delete several JS/CSS files at once.
- Do not delete anything directly referenced by `dist/index.html`.
- Do not delete the latest mobile UI files while production is still being verified.
- Do not delete files just to make the folder look clean.

If the user explicitly confirms one file deletion, delete only that one explicit path and then run checks.

Recommended cleanup direction:

- Create an asset inventory first.
- Keep the current production set stable.
- Consolidate future mobile overrides into fewer new files.
- Later, restore a real frontend source build pipeline so `dist/` can be regenerated cleanly.

## Current Mobile UI State

Mobile pages currently being tested:

- `/mobile`: fixed one-screen mobile home page with campus background, bottom input, and three campus agent buttons.
- `/chat`: mobile chat page with history/new chat top controls, send button, and campus agent switcher.
- `/mobile/rank`: mobile ranking page; it must allow vertical scrolling and leave enough bottom safe space for real mobile browser toolbars.

Mobile layout rules:

- Do not assume `100vh` equals the visible real phone area.
- Real mobile browsers may have a top address bar, bottom toolbar, keyboard, and safe-area insets.
- The home page can be one screen.
- Ranking pages and chat history must be scrollable.
- Chat composer layout must prioritize real phones over desktop preview.
- Avoid fixed pixel widths for real phone UI.

## Useful Commands

Local checks:

```bash
node --check server/src/server.js
cd server && npm run test:router
```

Production deploy:

```bash
cd ~/aimh1-ai-portal
git pull origin main
docker compose up -d --build
curl http://127.0.0.1:7998/api/health
```

## Recommended Next Work

Pause additional mobile visual patch stacking for now.

Recommended safe next steps:

1. Create an asset inventory report. Do not delete files.
2. Mark which JS/CSS files are currently active through `dist/index.html`.
3. Mark older files that appear unreferenced.
4. Let the user choose whether to delete anything.
5. If deleting, delete one explicit file at a time.
6. Consider rebuilding the frontend source pipeline before any major UI work.
7. After the asset situation is clear, continue with the Agent Center page.

## Agent Center Plan

The next product stage is an Agent Center.

It should not be a duplicate home page or a simple link list. It should:

- Help users understand what campus AI abilities are available.
- Let users choose agents by scenario.
- Let the project team later add, disable, sort, and measure agents without hard-editing the home page every time.

First version goals:

- Page path: `/agents`.
- Add or restore a top navigation entry for Agent Center.
- Preserve the current OAuth login strategy.
- Pin the three core campus agents:
  - Jiaowu Agent: `agent_id=jiaowu`
  - AI Librarian: `agent_id=library`
  - AI Counselor: `agent_id=xg`
- Show external tools as cards, clearly marked as external.
- Clicking a campus agent opens `/chat?agent_id=xxx`.
- Do not affect the current home page, chat page, rankings, feedback, join page, or admin dashboard.

Not in V1:

- Favorites
- User ratings
- Complex permission tiers
- Agent marketplace approval flows
- WebSocket status

Suggested agent card shape:

```json
{
  "id": "jiaowu",
  "name": "Jiaowu Agent",
  "category": "campus_service",
  "provider": "dify",
  "status": "online",
  "summary": "Course schedule, grades, exams, and training-plan questions.",
  "examples": [
    "How do I check this semester's exam schedule?",
    "How is GPA calculated?",
    "Where can I find my training plan?"
  ],
  "entryType": "chat",
  "agentId": "jiaowu",
  "targetUrl": "",
  "isInternal": true,
  "sortOrder": 10
}
```

Status values:

- `online`
- `maintenance`
- `building`
- `external`

Entry types:

- `chat`: open this portal's chat page with `agent_id`.
- `external`: open an external link.
- `disabled`: display only.

Agent Center warnings:

- Do not write real secrets into frontend code or GitHub.
- Do not rewrite the chat API for Agent Center.
- Do not restore old personnel or deprecated entries as core entries unless the user explicitly asks.
- Do not call external tools campus agents.
- Do not bulk-delete old frontend assets.
