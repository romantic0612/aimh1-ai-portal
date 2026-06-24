# AIMH1 Frontend Source

这是 AIMH1 门户的新源码版前端工程，用来逐步替代现在直接维护 `dist/assets/*.js` 的方式。

当前原则：

- 不直接覆盖生产 `dist/`。
- `npm run build` 默认输出到 `frontend/dist-preview`。
- 开发环境通过 Vite 代理访问后端 `http://127.0.0.1:3000`。
- 等页面和线上效果复刻稳定后，再决定是否切换生产构建输出。

## 页面

- `/` 首页
- `/mobile` 移动首页
- `/mobile/rank` 移动排行榜
- `/chat` 对话页
- `/agents` 智能体中心
- `/feedback` 反馈
- `/join` 加入共建

## 命令

```bash
cd frontend
npm install
npm run dev
```

预览构建：

```bash
cd frontend
npm run build
npm run preview
```

后端需要先启动在 `3000`：

```bash
cd ../server
npm start
```

## 切换生产前要做

1. 和当前 `dist/` 页面逐页对比。
2. 验证 CAS 登录、聊天流式、历史记录、排行、反馈、加入共建。
3. 确认移动端真机布局。
4. 修改 `vite.config.js` 的 `build.outDir` 到 `../dist`。
5. 再执行生产构建并提交新的 `dist/`。
