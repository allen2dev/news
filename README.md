# news

仓库包含：**News**（`web/`）— 面向 GitHub Pages 的开发者 RSS 阅读器；以及可选的旧版 **Express + Angular** 示例（`server.js`、`public/`）。

## News（Vite + React + TypeScript）

- **技术栈**：Vite 6、React 19、TypeScript、Tailwind CSS、Radix Dialog、Lucide、dOMPurify。
- **功能**：多频道、**SWR 按频道缓存**（切换回已访问频道先展示上次的列表，后台刷新）、搜索、明暗主题、Radix 模态。频道与源见 `web/src/lib/channels.ts`（含国内/港等更易访问的 RSS）。
- **数据**：CORS 代理 + XML 解析，失败再 rss2json；SWR `dedupingInterval` 5 分钟、**`keepPreviousData`** 切频道不闪空。

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
