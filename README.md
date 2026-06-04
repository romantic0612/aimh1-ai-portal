# AIMH1 AI Portal

## TP5.1 Migration Branch

This branch is migrating the project to:

- ThinkPHP 5.1 backend in `backend/`
- Vue workspace in `frontend/`
- Nginx static hosting for the existing `dist/`
- Docker Compose with separate Nginx and PHP-FPM services

The old Node/Express backend remains in `server/` as the behavior reference. The old Node image is preserved as `Dockerfile.legacy-node`; the current Docker Compose deployment uses `docker/php/Dockerfile` and `docker/nginx/Dockerfile`.

安徽农业大学 AI 门户。项目包含已打包前端 `dist/` 和 Node/Express 后端 `server/`，后端提供登录、SSE 流式聊天、聊天历史、排行榜、智能体列表、反馈、加入申请和后台观测台。

## Repository Workflow

- GitHub account: `romantic0612`
- Recommended public repository: `aimh1-ai-portal`
- `main`: deployable branch
- `feature/frontend-*`: frontend changes
- `feature/admin-dashboard`: admin dashboard changes

Do not commit real `.env`, database passwords, API keys, CAS secrets, logs, or `server/node_modules/`.

## Local Checks

```bash
docker compose up -d --build
curl http://127.0.0.1:7998/api/health
```

Legacy Node comparison checks remain available:

```bash
cd server
npm run test:router
node --check src/server.js
```

## Environment

Copy the example and fill real values only on the target machine:

```bash
cp server/.env.production.example .env
```

Important production settings:

```env
PORT=7998
MYSQL_POOL_SIZE=15
DIFY_CONNECT_TIMEOUT=15
DIFY_READ_TIMEOUT=600
DIFY_MAX_CONCURRENT=10
ADMIN_USER_IDS=your-admin-user-id
```

## Docker Deployment

Target server: `210.45.177.21`

```bash
git pull origin codex/tp51-vue-nginx-docker-migration
docker compose up -d --build
curl http://127.0.0.1:7998/api/health
```

Expected health response:

```json
{"ok":true}
```

The current branch runs Nginx plus PHP-FPM. The previous PM2 setup is preserved only as legacy reference files.

## Nginx

Use `deploy/nginx/aimh1-tp51.conf` as the container Nginx config. SSH is still separate from Nginx: SSH normally uses port `22`, while Nginx serves browser traffic on `80/443`.

The SSE endpoint `/api/chat/stream` must disable buffering:

```nginx
fastcgi_buffering off;
gzip off;
fastcgi_read_timeout 650s;
fastcgi_send_timeout 650s;
add_header X-Accel-Buffering no;
```

## Admin Dashboard

Open `/admin` after logging in with a user listed in `ADMIN_USER_IDS`.

The dashboard shows:

- visits and active users
- recent questions
- frequent questions
- session details
- tool calls and run status

The first version refreshes every 15 seconds and reuses existing analytics tables, plus `portal_visit_events` for visit tracking.
