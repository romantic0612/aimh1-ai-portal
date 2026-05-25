# AIMH1 Project Notes

## Safety Rules

禁止批量删除文件或目录。

不要使用：

- `del /s`
- `rd /s`
- `rmdir /s`
- `Remove-Item -Recurse`
- `rm -rf`

需要删除文件时，只能一次删除一个明确路径的文件，例如：

```powershell
Remove-Item "C:\path\to\file.txt"
```

如果需要批量删除文件，应停止操作，并让用户手动删除。

## Current App Shape

这是一个已打包前端加 Node/Express 后端的项目。

- 前端静态产物在 `dist/`。
- 后端在 `server/`。
- 后端入口是 `server/src/server.js`。
- 后端启动脚本在 `server/package.json`：`npm run dev` 或 `npm start`。
- 生产部署可使用根目录 `ecosystem.config.cjs`，通过 PM2 cluster 启动。
- 当前目录不是 Git 仓库。

## Current Capability Summary

当前代码主要实现一个安徽农业大学 AI 门户：

- CAS/OAuth 登录、退出、登录态查询。
- 静态前端托管，后端会在存在 `dist/` 时提供 SPA fallback。
- 聊天入口 `/api/chat/stream`，使用 SSE 流式返回。
- 聊天历史查询和详情查询。
- 智能路由：根据用户问题选择默认模型或业务 Dify 智能体。
- 多智能体并行：同一问题命中多个业务场景时，可并行调用多个 Dify 智能体，再由默认模型汇总。
- 排行榜 `/api/rankings`，基于用户使用次数、有效调用、token 等统计。
- 智能体列表 `/api/agents`，从数据库的 `portal_agent_links` 读取。
- 反馈和加入申请提交。
- 运行统计：记录 session、message、run、step、tool call、usage counter、daily stats。

主要接口：

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

## Production Concurrency Setup

当前已为 21 门户服务器做 100 个同时聊天请求的并发改造。

- PM2 配置文件：`ecosystem.config.cjs`。
- PM2 应用名：`aimh1-portal`。
- PM2 模式：`exec_mode: "cluster"`。
- PM2 实例数：`instances: 10`。
- 单实例内存重启阈值：`max_memory_restart: "1G"`。
- 生产端口：`PORT=7998`。

推荐启动：

```bash
cd /path/to/AIMH1
pm2 start ecosystem.config.cjs --env production
pm2 save
```

健康检查：

```bash
curl http://127.0.0.1:7998/api/health
```

应返回：

```json
{"ok":true}
```

## Session And Database

生产环境使用 MySQL 共享 session，以支持 PM2 多实例登录态共享。

关键配置在 `server/.env`：

```env
SESSION_STORE=mysql
MYSQL_POOL_SIZE=15
```

session 表固定为：

```text
portal_sessions
```

所有门户相关表都建在 `114.213.146.102` 的 `aimh` 数据库中。`portal_sessions` 已由用户在 `114.213.146.102` 上建好。

如果以后需要手动建表，可使用：

```sql
USE aimh;

CREATE TABLE IF NOT EXISTS portal_sessions (
  session_id VARCHAR(128) NOT NULL,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT,
  PRIMARY KEY (session_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
```

注意：不要在回复中复述真实密钥、数据库密码或 API Key。

## Dify And LLM Routing

智能路由核心在 `server/src/server.js` 和 `server/src/agentRouter.js`：

- `AGENT_REGISTRY`：智能体注册表。
- `buildAgent(agentId)`：根据 agent id 组装具体能力。
- `selectAgentByRuleV2(message, context)`：规则路由。
- `selectAgent(message, context)`：总路由入口，优先 LLM planner，失败或未配置时回退规则路由。
- `/api/chat/stream`：调用 `selectAgent(message)` 后，决定走默认模型、单个 Dify、还是多 Dify 并行后汇总。

路由目标：

- `general`：默认 MiniMax/兼容 OpenAI Chat Completions 的通用模型。
- `jiaowu`：教务 Dify 智能体。
- `renshi`：人事 Dify 智能体。
- `library`：AI 馆员 Dify 智能体。
- `nongxiaoxin`：新生校园向导 Dify 智能体。

大致流程：

```text
用户消息 -> selectAgent(message)
  -> general：streamGeneralAnswer
  -> 单业务智能体：streamDifyAnswer
  -> 多业务智能体：Promise.all 调用业务 Dify -> streamSupervisorSummary 汇总
```

门户侧 Dify 并发限制：

```env
DIFY_CONNECT_TIMEOUT=15
DIFY_READ_TIMEOUT=600
DIFY_MAX_CONCURRENT=10
```

含义：

- `DIFY_CONNECT_TIMEOUT=15`：连接 Dify 阶段最多等待 15 秒。
- `DIFY_READ_TIMEOUT=600`：Dify 流式读取最多等待 600 秒。
- `DIFY_MAX_CONCURRENT=10`：每个 Node 实例最多同时调用 10 个 Dify 请求。
- PM2 10 实例时，门户侧总 Dify 并发约 100。

## Current Frontend Entry

当前 `dist/index.html` 使用的资源以文件内容为准。修改前端打包产物时，必须先读取当前 `dist/index.html`。

后续每改一版打包产物，都要新建一个带日期/序号的新文件名，并同步更新 `dist/index.html` 引用，避免浏览器缓存和版本混乱。

示例：

```text
index-feedback-wide-20260513a.css
index-feedback-wide-20260513b.css
index-rank-role-fix-20260513a.js
```

## Recent UI Changes

已完成的页面调整：

- 聊天页顶部三个智能体状态块已隐藏。
- 聊天页右侧“智能体链接”和“办理链接”栏已隐藏。
- 聊天区已扩展为“左侧历史 + 右侧大聊天区”。
- 聊天页小标题已显示为“农芯智AI”。
- 顶部导航里的“智能体中心”入口已隐藏。
- 顶部校名图仍使用 `/文化标识.png`，但文件内容已替换为黑底白字图片。

这些调整主要落在 CSS 打包产物中。后续如需再改 UI，必须新建带日期/序号的新 CSS/JS 文件，而不是直接覆盖旧文件。

## Asset Rule

顶部品牌图的页面引用不要改路径，继续使用：

```text
dist/文化标识.png
```

如果用户提供新的品牌图，优先把新图内容覆盖到 `dist/文化标识.png`，而不是改 JS 中的图片路径。

## Ranking Notes

之前出现过排行榜显示 `me`、`student-2`、`student-3` 的情况。原因是数据库/服务器断开后，前端拿不到真实排行榜数据，自动显示了内置兜底假数据。

后端 `/api/rankings` 已调整为从以下表合并用户集合，避免只查 `portal_users` 导致历史用户不显示：

- `portal_users`
- `portal_usage_counter`
- `portal_agent_daily_stats`

如果排行榜仍显示占位数据，先检查服务器和 MySQL 是否正常，再看后端日志：

```text
[mysql] query fallback
[rankings] failed
```

## Config And Secrets

`server/.env` 用于真实运行配置。

`server/.env.production.example` 必须只保留占位符示例，不要写入真实连接信息、数据库密码或 API Key。

如果凭据已经上传、截图或分享过，建议轮换。

## Editing Preferences

- 优先改源文件；但当前前端只有打包产物，所以 UI 修改通常改 `dist/assets/*.css` 或 `dist/assets/*.js`。
- 改前端打包产物时必须新建版本文件，再更新 `dist/index.html`。
- 不要批量删除旧版本资源；如果需要清理，先列出当前 `index.html` 正在引用的 JS/CSS，让用户手动删旧文件，或一次只删除一个明确文件。
- 中文乱码主要出现在终端读取打包 JS/部分后端字符串时，可能是编码显示问题；修改时尽量避免无必要直接编辑乱码大块文本。
- 后端部署配置和源文件可直接修改原文件，不需要像前端打包产物一样新建版本名。

## Useful Commands

后端本地检查：

```bash
cd server
npm install
npm run test:router
node --check src/server.js
```

生产 PM2：

```bash
cd /path/to/AIMH1
pm2 start ecosystem.config.cjs --env production
pm2 status
pm2 logs aimh1-portal
pm2 save
```
