# news

仓库包含：**Pulse**（`web/`）— 面向 GitHub Pages 的开发者 RSS 阅读器；以及可选的旧版 **Express + Angular** 示例（`server.js`、`public/`）。

## Pulse（Vite + React + TypeScript）

- **技术栈**：Vite 6、React 19、TypeScript、Tailwind CSS、Radix Dialog、Lucide、dOMPurify。
- **功能**：开发者 RSS（GitHub Blog、Dev.to、CSS-Tricks）、搜索、明暗主题、卡片网格、**Radix 模态详情**；正文经 **DOMPurify** 白名单净化（含表格、多层级标题等，防 XSS）后 `dangerouslySetInnerHTML` 渲染。
- **数据**：先经 CORS 代理拉取 XML 并解析，失败再试 rss2json（见 `web/src/lib/rss.ts`）。

### 本地开发

```bash
cd web
npm install
npm run dev
```

生产构建（含 GitHub Pages 子路径 `/news/`）：

```bash
cd web
GITHUB_ACTIONS=true npm run build
```

产物在 `web/dist/`。

### GitHub Pages

工作流 `.github/workflows/pages.yml` 在 `web/` 执行 `npm ci && npm run build`，上传 **`web/dist`**。请在仓库 **Settings → Pages** 中选择 **GitHub Actions** 作为来源。

线上地址见根目录 `package.json` 的 `homepage`（默认可为 `https://allen2dev.github.io/news/`）。

## 原始后端（可选）

Node 示例入口：`server.js` 与 `public/`。
