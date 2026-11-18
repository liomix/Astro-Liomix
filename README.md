# Liomix Blog

个人站点。当前 README 只写技术栈，其余章节后补。

## 技术栈

### 基础

| 层 | 选型 | 版本 |
| --- | --- | --- |
| 框架 | [Astro](https://astro.build)（静态输出，`CF_WORKERS` 时切 Cloudflare 适配器） | 7.3.2 |
| 交互岛 | [Svelte](https://svelte.dev)（runes / `$state` / `$props`）+ `@astrojs/svelte` | 5.57 / 9.0 |
| 语言 | TypeScript（`strict: true`，`tsc --noEmit --isolatedDeclarations` 校验） | 6.0 |
| 运行时 | Node.js ≥ 22.23，包管理 pnpm（`preinstall` 强制） | pnpm 11.22 |
| 格式化 / Lint | [Biome](https://biomejs.dev)（tab 缩进、双引号） | 2.6 |

### 样式

- **Tailwind CSS 4**（`@tailwindcss/vite` 插件版，非 PostCSS 老链路）+ `@tailwindcss/typography` 正文排版
- PostCSS：`postcss-import` 拆文件、`postcss-nesting` 嵌套；`variables.styl` / `markdown-extend.styl` 保留 Stylus 变量表
- 原生 CSS 分层：`@layer base / components / utilities` 打底，组件 `<style>`（unlayered）负责局部覆盖
- 主题切换走 `:root.dark` + CSS 变量，不依赖框架运行时

### 内容管线

- **MDX 8** + `@astrojs/markdown-remark` 7，`trailingSlash: "always"`
- remark：`remark-math`（数学）、`remark-directive`（自定义指令）、`remark-sectionize`（章节切分）、`remark-reading-time`、`remark-excerpt`、`remark-image-grid`、`remark-wiki-link`、`remark-mermaid`、`remark-plantuml`
- rehype：`rehype-slug` / `rehype-autolink-headings`（标题锚点）、`rehype-katex`（+ mhchem 化学式）、`rehype-callouts`（提示块）、`rehype-code-group`（Tab 代码块）、`rehype-figure`、外链 / 邮箱保护、图示缩放
- 站内自写插件：GitHub 仓库卡片（`rehype-component-github-card`）、指令解析、图片网格、Mermaid / PlantUML 转换

### 代码块与图示

- **Expressive Code 0.44**：亮暗双主题、行号、可折叠分段（`plugin-collapsible-sections`）、语言徽标与语言图标
- **Mermaid** → `@mermanjs/web`（WASM 在构建期把图渲染成 SVG，不把渲染器发给浏览器）
- **PlantUML** → `pako` 压缩编码后走远端渲染
- **KaTeX 0.19**：行内 / 块级公式
- **ECharts 6**：文章内数据图（分类玫瑰图），按需加载

### 前端交互

- **Swup（`@swup/astro` 1.8）**：无刷新切页，按容器替换（正文、两侧栏、浮动目录、横幅），带预加载与滚动位置处理
- **Lottie（`lottie-web` 5.13）**：点赞 / 评论 / 空态插画 / 导航栏 Logo / 打赏金币，统一封装成 `<dynamic-lottie-icon>`、`<empty-lottie>` 两个自定义元素，按需加载（进视口或点击才取 JSON）
- **Fancybox 6**：相册与正文大图灯箱
- **Live2D（`l2d-widget`）**：可开关的看板娘
- **Marked**：评论区与动态（Memos）正文的轻量 Markdown 渲染
- 原生 Web API 兜底：`IntersectionObserver`、`ResizeObserver`、`LocalStorage`、`postMessage`（评论抽屉 iframe 与父页面通信）

### 搜索

- **Pagefind 1.5**：构建产物里二次建索引，前端只拉分片结果；`scripts/run-pagefind.ts` 收尾执行，另有独立搜索页与弹层两套入口

### 图片 / 字体 / SEO

- **Sharp**：构建期生成 LQIP（2×2 取色，`scripts/generate-lqips.ts`）、封面与 VNDB 封面预处理
- Astro `<Image>` / `<Picture>` 响应式输出；动态头像与壁纸用 `?url` 直出原文件绕过优化
- **Astro Fonts API**（`fonts:` + `fontProviders`）按实际引用的 CSS 变量裁剪，配合 fontsource 包（Noto Sans SC Variable、Inter、JetBrains Mono、Zen Maru Gothic）与 `subset-font` 构建期子集化
- **takumi-js**：`/og/[...slug]` 运行时生成每篇文章的 OG 图
- `@astrojs/sitemap` + `@astrojs/rss` 输出站点地图与订阅源
- **astro-icon + Iconify** 离线图标集（material-symbols、Font Awesome 7 三套、simple-icons、mdi、mingcute），无运行时请求

### 工程与部署

- 脚本层：`tsx` 直接跑 TS 脚本，`esbuild` 做转译校验；构建链 = 图标 / LQIP / 封面 → `astro build` → 密钥检查 → 字体子集 → 内联脚本压缩 → Pagefind
- 部署：**Vercel**（`vercel.json`，静态产物 + CSP / HSTS / 权限策略等安全头）；可选 **Cloudflare Workers**（`@astrojs/cloudflare` + `wrangler` 4，`nodejs_compat`）
- 外部自建服务：访问统计、点赞、评论都打自建 HTTP API，前端只做契约层（`siteStatsConfig` / `likeApiConfig` / `commentApiConfig` + `*-client.ts`），不含第三方评论组件
