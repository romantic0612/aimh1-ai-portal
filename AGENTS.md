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
- GitHub 仓库：`https://github.com/romantic0612/aimh1-ai-portal.git`。
- 生产访问域名：`https://sjaigc.ahau.edu.cn/`。

## Core Capability Summary

当前代码主要实现安徽农业大学 AI 门户：

- CAS/OAuth 登录、退出、登录态查询。
- 静态前端托管，后端在存在 `dist/` 时提供 SPA fallback。
- 聊天入口 `/api/chat/stream`，使用 SSE 流式返回。
- 聊天历史查询、详情查询、单条删除、全部清空。
- 首页和聊天页支持三个校内智能体：教务智能体、AI馆员、AI辅导员。
- 不选智能体时走默认 MiniMax/兼容 OpenAI Chat Completions 的通用模型。
- 选中智能体时强制走对应 Dify 智能体，不再做自动路由。
- 排行榜 `/api/rankings`，基于用户使用次数、有效调用、token 等统计。
- 智能体列表 `/api/agents`，可从数据库的 `portal_agent_links` 读取。
- 反馈和加入申请提交。
- 后台观测台用于查看访问、问题、热门问题、错误调用和趋势。

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

## Production Setup

生产部署使用 Docker + PM2 cluster。

- PM2 配置文件：`ecosystem.config.cjs`
- PM2 应用名：`aimh1-portal`
- PM2 模式：`exec_mode: "cluster"`
- PM2 实例数：`instances: 10`
- 单实例内存重启阈值：`max_memory_restart: "1G"`
- 生产端口：`PORT=7998`

部署命令：

```bash
cd ~/aimh1-ai-portal
git pull origin main
docker compose up -d --build
curl http://127.0.0.1:7998/api/health
```

健康检查应返回：

```json
{"ok":true}
```

## Session And Database

生产环境使用 MySQL 共享 session，以支持 PM2 多实例登录态共享。

关键配置在服务器 `server/.env`：

```env
SESSION_STORE=mysql
MYSQL_POOL_SIZE=15
```

session 表固定为：

```text
portal_sessions
```

注意：

- 不要在 GitHub 提交真实 `.env`。
- 不要在回复中复述真实密钥、数据库密码或 API Key。
- 如果凭据已经上传、截图或分享过，建议轮换。

## Dify And LLM Routing

路由核心在 `server/src/server.js` 和 `server/src/agentRouter.js`。

当前产品逻辑：

- `general`：默认模型，不展示为按钮。
- `jiaowu`：教务智能体。
- `library`：AI馆员。
- `xg`：AI辅导员。

当前聊天逻辑：

```text
用户不选按钮 -> general 默认模型
用户选教务智能体 -> agent_id=jiaowu
用户选AI馆员 -> agent_id=library
用户选AI辅导员 -> agent_id=xg
```

首页和聊天页都遵守这个逻辑。

聊天页输入框上方有三个校内智能体切换按钮：

- 默认都不选中。
- 点某个按钮后，后续发送带对应 `agent_id`。
- 再点一次已选按钮，取消选择并回到默认模型。
- 历史记录回看时不显示切换器。

Dify 并发配置：

```env
DIFY_CONNECT_TIMEOUT=15
DIFY_READ_TIMEOUT=600
DIFY_MAX_CONCURRENT=10
```

含义：

- 每个 Node 实例最多同时调用 10 个 Dify 请求。
- PM2 10 实例时，门户侧总 Dify 并发约 100。

## Frontend Asset Rules

当前前端只有打包产物，入口是 `dist/index.html`。

修改前端打包产物时必须：

- 先读取当前 `dist/index.html`。
- 新建带日期/序号的新 JS/CSS 文件。
- 更新 `dist/index.html` 引用新文件。
- 不直接覆盖旧版本资源。
- 不批量删除旧资源。

示例：

```text
index-chat-agent-switch-20260527a.js
index-chat-agent-switch-20260527a.css
```

顶部品牌图路径不要随意改，继续使用当前页面引用。

## Recent UI State

当前首页状态：

- 首页视觉已经回到农业大学门户风格。
- 首页保留品牌、校园图、提问框、三个校内智能体按钮、排行榜。
- 首页三个按钮为：教务智能体、AI馆员、AI辅导员。
- 首页默认不选按钮时走默认模型。

当前聊天页状态：

- 左侧历史 + 右侧大聊天区。
- 历史时间已修正为北京时间，不再把 MySQL `NOW()` 错误加 8 小时。
- 用户消息靠右。
- AI 回复靠左，透明背景，统一紧凑 Markdown 样式。
- 发送时使用动态思考点，不提前显示空白回复框。
- 支持历史单条删除和全部清空。
- 输入框上方可切换三个校内智能体。

## GitHub Collaboration

Repository collaborator settings:

```text
https://github.com/romantic0612/aimh1-ai-portal/settings/access
```

团队协作建议：

- `main`：可部署版本。
- 前端分支：`feature/frontend-*`
- 后台分支：`feature/admin-*`
- 智能体中心分支：`feature/agent-center`
- 队友不需要 SSH 登录服务器，只需要 GitHub 协作权限。
- 服务器只从 `main` 执行 `git pull origin main`。

## Useful Commands

本地检查：

```bash
node --check server/src/server.js
cd server && npm run test:router
```

生产部署：

```bash
cd ~/aimh1-ai-portal
git pull origin main
docker compose up -d --build
curl http://127.0.0.1:7998/api/health
```

## Next Stage: Agent Center

下一步重点是建设“智能体中心”。

智能体中心不是首页的重复版本，也不是简单链接列表。它应该承担三个作用：

- 让用户快速理解学校有哪些 AI 能力可以用。
- 让用户按场景选择合适的智能体，并进入聊天页或外部系统。
- 让项目组以后能持续新增、下线、排序、统计智能体，而不用每次硬改首页。

首页继续保持轻量：

- 品牌。
- 三个核心校内智能体入口。
- 排行榜。
- 基础提问入口。

智能体中心承担扩展：

- 校内智能体。
- 校外智能体。
- 建设中智能体。
- 部门共建入口。
- 使用数据展示。

### Agent Center V1 Goal

第一版只做“可用、清晰、好维护”，不要一上来做复杂市场。

必须完成：

- 页面路径：`/agents`。
- 恢复或新增顶部导航“智能体中心”入口。
- 保留现有 OAuth 登录态，不做匿名开放。
- 三个校内核心智能体置顶：
  - 教务智能体：`agent_id=jiaowu`
  - AI馆员：`agent_id=library`
  - AI辅导员：`agent_id=xg`
- 校外智能体以介绍卡片形式展示，能跳外链或显示“建设中”。
- 点击校内智能体时进入 `/chat?agent_id=xxx`，聊天页继续使用现有 SSE。
- 不影响首页、聊天页、排行榜、反馈、加入申请、后台观测。

暂不做：

- 智能体收藏。
- 用户评分。
- 复杂权限分级。
- 智能体市场审核流。
- WebSocket 实时状态。

### Page Structure

智能体中心建议分四块。

顶部工具区：

- 标题：智能体中心
- 副标题：选择适合的校园 AI 能力
- 搜索框：按名称、场景、部门搜索
- 分类 Tab：全部、校内服务、学习科研、行政办公、生活服务、校外工具

核心校内智能体：

- 三张重点卡片。
- 字段包括名称、服务范围、适合问题示例、状态标签、使用次数、开始咨询按钮。

校外智能体与工具：

- 展示学校允许推荐的外部 AI 工具或竞赛工具。
- 必须标明“外部工具”。
- 涉及账号、隐私、论文、数据上传时要有提示。

共建与申请：

- 部门想接入智能体。
- 学院想做知识库。
- 学生团队想参与共建。
- 跳转到 `/join` 或 `/feedback`。

### Agent Card Fields

第一版前端可以先写死，也可以读取 `/api/agents`。

推荐最终由后端返回：

```json
{
  "id": "jiaowu",
  "name": "教务智能体",
  "category": "校内服务",
  "provider": "dify",
  "status": "online",
  "summary": "课表、成绩、考试安排、培养方案等教务咨询。",
  "examples": [
    "这学期考试安排怎么看？",
    "绩点怎么算？",
    "培养方案在哪里查？"
  ],
  "entryType": "chat",
  "agentId": "jiaowu",
  "targetUrl": "",
  "isInternal": true,
  "sortOrder": 10
}
```

状态枚举：

- `online`：可用
- `maintenance`：维护中
- `building`：建设中
- `external`：外部工具

入口类型：

- `chat`：进入本门户聊天页并带 `agent_id`
- `external`：打开外链
- `disabled`：只展示，不可进入

### Backend Plan

现有接口：

```text
GET /api/agents
```

第一版可以继续复用。

建议返回结构：

```json
{
  "agents": [],
  "categories": [],
  "updatedAt": "2026-05-27 21:30:00"
}
```

后续可以增加管理接口：

```text
GET /api/admin/agents
POST /api/admin/agents
PATCH /api/admin/agents/:id
POST /api/admin/agents/:id/toggle
```

权限：

- 普通用户只读 `/api/agents`。
- 管理员通过 `ADMIN_USER_IDS` 访问管理接口。

### Database Plan

当前已有 `portal_agent_links` 概念，可以继续扩展。

建议字段：

```sql
agent_id
name
category
provider
status
summary
detail
examples_json
entry_type
target_url
is_internal
sort_order
created_at
updated_at
```

第一版不强制建新表。如果当前表字段不够，先由后端组装默认数据，保证页面能上线。

### Visual Direction

智能体中心应当像“校园 AI 应用工作台”，不是宣传页。

风格建议：

- 背景浅绿色或白色。
- 卡片 8px 圆角以内。
- 信息密度比首页高。
- 使用状态标签、分类 Tab、搜索框、紧凑卡片。
- 三个校内智能体可以更醒目，但不要做超大 Hero。

卡片布局：

```text
左上：名称 + 状态
中间：简介 + 适合问题
底部：分类标签 + 开始咨询按钮
```

移动端：

- 单列卡片。
- 搜索框固定在列表上方。
- Tab 可横向滚动。
- 按钮不可撑破卡片。

### Development Steps

第一步：静态可用版

- 恢复或新增顶部“智能体中心”入口。
- 新建 `/agents` 页面。
- 写死三大校内智能体和若干校外工具。
- 点击校内智能体跳 `/chat?agent_id=xxx`。
- 页面不依赖新数据库。

第二步：接口驱动版

- `/api/agents` 返回统一字段。
- 页面从接口读取。
- 后端保留默认兜底数据，数据库异常时页面不空白。
- 后台观测台增加“智能体调用概览”。

第三步：管理配置版

- 后台 `/admin` 增加智能体管理。
- 管理员可以改名称、简介、状态、排序、外链。
- 支持上线/下线。
- 支持查看每个智能体使用次数、错误率、平均耗时。

### Acceptance Criteria

功能：

- `/agents` 可访问。
- 三个校内智能体能正确进入聊天页。
- 外部工具能正确打开或显示建设中。
- 搜索和分类可用。
- 不影响首页和聊天页当前功能。

接口：

- `/api/agents` 正常返回。
- 数据库异常时有兜底数据。
- 未登录用户按当前门户策略处理。

视觉：

- 页面不像旧版静态链接页。
- 三个核心智能体足够明显。
- 信息密度适合电脑端重复使用。
- 移动端不溢出、不重叠。

部署：

```bash
node --check server/src/server.js
cd server && npm run test:router
docker compose up -d --build
curl http://127.0.0.1:7998/api/health
```

### Agent Center Warnings

- 不要把真实 API Key、数据库密码、CAS secret 写进页面或 GitHub。
- 不要为了智能体中心重写聊天接口。
- 不要恢复旧的人事/农小新入口为核心入口，除非用户明确要求。
- 不要把外部工具称为校内智能体。
- 不要批量删除旧前端资源。
- 前端打包产物仍然要新建版本化 JS/CSS，再更新 `dist/index.html`。
