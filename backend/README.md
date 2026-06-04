# AIMH1 ThinkPHP 5.1 Backend

This is the new PHP backend for the migration branch.

The goal is API compatibility with the previous Node/Express service while preserving the current frontend content in `../dist/`.

## Runtime

- PHP 7.4 FPM
- ThinkPHP 5.1
- MySQL via the existing environment variables
- Nginx serves `dist/` and forwards `/api/*` plus `/callback` to PHP-FPM

## Important Endpoints

The route file keeps the existing public API surface:

- `GET /api/health`
- `GET /api/auth/session`
- `GET /api/announcements`
- `GET /api/chat/history`
- `GET /api/chat/history/detail`
- `DELETE /api/chat/history/:sessionId`
- `DELETE /api/chat/history`
- `POST /api/chat/stream`
- `GET /api/rankings`
- `GET /api/agents`
- `POST /api/feedback`
- `POST /api/join`
- `GET /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/exchange`
- `GET /callback`

## Migration Notes

`/api/chat/stream` already emits SSE in the same `data: {...}` shape used by the existing frontend.
Campus agent selection is preserved:

- no selected campus agent -> general model
- `agent_id=jiaowu` -> Dify Jiaowu Agent
- `agent_id=library` -> Dify AI Librarian
- `agent_id=xg` -> Dify AI Counselor

The old Node backend remains in `../server/` for comparison during migration.
