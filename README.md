# news

一个新闻网站：仓库根目录保留原有的 Express + Angular 后台示例；**静态新闻聚合展示**位于 `docs/`，用于部署到 **GitHub Pages**。

## GitHub Pages 静态站点（Pulse）

- 打开路径：`docs/index.html`（线上为站点根路径）。
- 设计：深色极光背景、玻璃拟态卡片、多分类 Tab、搜索与刷新。
- 数据：优先请求 [rss2json](https://rss2json.com/)；若某源返回 error（如部分 Reuters 源），则通过公开 CORS 代理拉取 **原始 RSS/Atom** 并在浏览器内用 `DOMParser` 解析，因此仍可在应用内阅读图文。

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
