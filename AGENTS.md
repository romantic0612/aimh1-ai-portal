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
- Production domain: `https://ai.ahau.edu.cn/`.

## Production Setup

Production uses Docker plus PM2 cluster.

- PM2 app name: `aimh1-portal`
- PM2 mode: `exec_mode: "cluster"`
- PM2 instances: `10`
- Memory restart limit: `1G`
- Production source port: `3000`
- Public HTTPS port: `443`

Deploy:

```bash
cd ~/aimh1-ai-portal
git pull origin main
docker compose up -d --build
curl http://127.0.0.1:3000/api/health
```

Expected health response:

```json
{"ok":true}
```

### Node74 Server Notes

Server `210.45.177.74` has special Docker networking constraints:

- Docker version: `19.03.5`.
- Docker bridge networking is disabled in `/etc/docker/daemon.json` with `"bridge": "none"`.
- Docker Compose v2 is available, but `docker compose up -d --build` fails during image build with `network bridge not found`.
- Docker `19.03.5` does not support the Compose `host-gateway` shortcut for `host.docker.internal`.
- Build images manually with host networking:

```bash
docker build --network=host -t aimh1-ai-portal:latest .
docker compose up -d --no-build
```

For the portal container on this server, use host networking:

```yaml
network_mode: "host"
```

With host networking, the portal can proxy AI Service Navigator through:

```env
SERVICE_PROXY_TARGET=http://127.0.0.1:3101
```

Do not switch this server back to `host.docker.internal:host-gateway` unless Docker is upgraded to a version that supports it and the deployment is retested.

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

## OAuth/CAS Configuration

Anhui Agricultural University unified identity uses the SUDY CAS OAuth2 integration.

Current production OAuth settings:

```env
OAUTH_AUTH_SERVER=https://ids.ahau.edu.cn/cas/oauth2.0
OAUTH_CLIENT_ID=aimh
OAUTH_REDIRECT_URI=https://ai.ahau.edu.cn/callback
OAUTH_SCOPE=cas_get_userInfo
OAUTH_USERINFO_ENDPOINT=https://ids.ahau.edu.cn/cas/oauth2.0/profile
```

Rules:

- `OAUTH_AUTH_SERVER` is the base OAuth path only; the backend appends `/authorize` and `/accessToken`.
- `OAUTH_USERINFO_ENDPOINT` is the full profile endpoint.
- `OAUTH_CLIENT_SECRET` must be filled only in the server `.env`; never commit it or repeat it in replies.
- If the production domain changes, update both `FRONTEND_ORIGIN` and `OAUTH_REDIRECT_URI`, and ask the OAuth/CAS administrator to register the exact callback URL.
- For the current migration, public domain is `https://ai.ahau.edu.cn` and callback is `https://ai.ahau.edu.cn/callback`.

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
2. Prefer editing the currently active JS/CSS file already referenced by `dist/index.html`.
3. Do not create a new JS/CSS file for every small change.
4. Create a new dated file only for a large risky change, a rollback boundary, or when the user explicitly asks for version isolation.
5. If a new file is created, update `dist/index.html` and explain why a new file was necessary.
6. Do not bulk-delete old assets.
7. Do not casually change the top brand image paths.

Current maintenance preference:

```text
Small fixes -> edit the active referenced file.
Mobile CSS fixes -> edit the latest active mobile CSS file when possible.
Mobile JS fixes -> edit the latest active mobile JS file when possible.
Large redesigns -> create one new consolidated CSS/JS pair, not many tiny files.
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
- Consolidate future mobile overrides into fewer active files.
- After consolidation, edit those active files directly for ordinary fixes.
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
curl http://127.0.0.1:3000/api/health
```

## Recommended Next Work

Pause additional mobile visual patch stacking for now.

Recommended safe next steps:

1. Create an asset inventory report. Do not delete files.
2. Mark which JS/CSS files are currently active through `dist/index.html`.
3. Mark older files that appear unreferenced.
4. Let the user choose whether to delete anything.
5. If deleting, delete one explicit file at a time.
6. Consolidate the active mobile patches into fewer maintained files when practical.
7. Consider rebuilding the frontend source pipeline before any major UI work.
8. After the asset situation is clear, continue with the Agent Center page.

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
