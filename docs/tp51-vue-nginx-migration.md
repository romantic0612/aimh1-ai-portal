# TP5.1 / Vue / Nginx / Docker Migration

Branch: `codex/tp51-vue-nginx-docker-migration`

## What Changed

- Added a new ThinkPHP 5.1 backend under `backend/`.
- Added a Vue workspace under `frontend/` without overwriting the current packaged frontend.
- Changed Docker Compose to run `aimh1-nginx` and `aimh1-php` instead of Node/PM2.
- Added Nginx config that serves existing `dist/` assets and forwards `/api/*` plus `/callback` to PHP-FPM.
- Preserved the legacy Node backend in `server/` as the behavior reference.

## Deployment Shape

```text
browser
  -> nginx :7998
     -> static files from dist/
     -> PHP-FPM for /api/* and /callback
        -> ThinkPHP 5.1 backend
        -> MySQL / OAuth / Dify / general model
```

## Build

```bash
docker compose up -d --build
curl http://127.0.0.1:7998/api/health
```

Expected:

```json
{"ok":true}
```

## Current State

This is the first migration implementation. It provides the TP5.1 routing and controller layer and keeps the existing API paths.

The most important remaining verification work is:

- Compare `/api/chat/stream` SSE output against production Node behavior.
- Confirm OAuth callback fields with the real CAS server.
- Re-implement MySQL-backed session storage for PHP-FPM if multi-instance login sharing is required.
- Confirm MySQL table schemas match the insert/update statements used by the PHP backend.
- Rebuild the Vue source page by page before replacing `dist/`.

## Safety

- No old assets were deleted.
- `server/` was not removed.
- Existing `dist/` content was not overwritten.
- Secrets remain in environment variables only.
