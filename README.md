# news

一个新闻网站：仓库根目录保留原有的 Express + Angular 后台示例；**静态新闻聚合展示**位于 `docs/`，用于部署到 **GitHub Pages**。

## GitHub Pages 静态站点（Pulse）

- 仅 **开发者** RSS：GitHub Blog、Dev.to、CSS-Tricks（`docs/js/app.js` 中 `FEEDS`）。
- 新闻详情在 **模态框** 中展示；打开/关闭使用 **View Transitions API**（`document.startViewTransition` + 命名过渡 `modal-backdrop` / `modal-dialog`），不支持的浏览器会立即切换无动画。
- 数据拉取：先 CORS 代理 + 本地解析 XML，失败再试 rss2json（见 `docs/js/app.js`）。

### 本地预览

```bash
npm run preview:pages
```

浏览器访问 `http://localhost:4173`。

### 启用 Pages

1. 仓库 **Settings → Pages → Build and deployment**：Source 选择 **GitHub Actions**。
2. 将含 `.github/workflows/pages.yml` 的分支合并进默认分支后，工作流会把 `docs/` 部署为站点根目录。

默认 Pages URL 见 `package.json` 的 `homepage`；若你的 Fork 用户名不同，请改成 `https://<user>.github.io/news/`。

## 原始后端（可选）

包含前台展示新闻、后台添加修改新闻的 Node 示例，入口见 `server.js` 与 `public/`。
