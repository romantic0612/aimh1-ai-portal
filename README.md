# AIMH1 AI Portal

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
cd server
npm install
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
SESSION_STORE=mysql
MYSQL_POOL_SIZE=15
DIFY_CONNECT_TIMEOUT=15
DIFY_READ_TIMEOUT=600
DIFY_MAX_CONCURRENT=10
ADMIN_USER_IDS=your-admin-user-id
```

With PM2 `instances: 10` and `DIFY_MAX_CONCURRENT=10`, the portal-side Dify concurrency is about 100.

## Docker Deployment

Target server: `210.45.177.21`

```bash
git pull origin main
docker compose up -d --build
curl http://127.0.0.1:7998/api/health
```

Expected health response:

```json
{"ok":true}
```

The container runs `pm2-runtime ecosystem.config.cjs --env production`, preserving the existing PM2 cluster setup.

## Nginx

Use `deploy/nginx/aimh1-portal.conf` as a starting point. SSH is still separate from Nginx: SSH normally uses port `22`, while Nginx serves browser traffic on `80/443`.

The SSE endpoint `/api/chat/stream` must disable buffering:

```nginx
proxy_buffering off;
proxy_cache off;
gzip off;
proxy_read_timeout 650s;
proxy_send_timeout 650s;
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
