# Components

目录名 = 领域。判断标准：**删掉某个功能，需要动几个目录** —— 理想是 1 个。
通用层留在顶层，功能域一律进 `features/`。

```
src/components/
├─ features/                  按功能划分（删一个功能只动一个目录）
│  ├─ comment/                评论：Comment.astro + 顶栏/输入栏/表情/壁纸逻辑 + PostComments
│  ├─ post/                   文章：PostCard / PostHeader / PostMeta / PostPage / PostStats / SeriesNav / License / ShareButton / Encrypted*
│  ├─ dynamic/                动态：DynamicItemTemplate / DynamicFeed / DynamicGallery / DynamicActionBar / 侧栏预览
│  ├─ guestbook/              留言墙：GuestbookWall + GuestTag + 类型与配色
│  ├─ catalog/                条目库：bangumi/ mal/ vndb/ bilibili/ gallery/ projects/
│  ├─ books/                  阅读：BookPopover / Bookshelf3D / ReadingHeatmap
│  ├─ music/                  音乐：MusicPlayer / MusicManager / NowPlayingCard / PlaybackSettings / NavMusicButton
│  ├─ effects/                视觉特效：Sakura / Waves / Typewriter / Live2D / Spine / BackgroundPlayer / PioMessageBox
│  ├─ stats/                  统计与图表：SiteVisitCounter / PostViewCounter / SiteStats / PostActivity / 两个图表
│  └─ sponsor/                打赏：SponsorButton / SponsorButtonLottie / SponsorPop
├─ ui/                        纯展示原子：AvatarImage / Badge / CoverImage / Icon / Skeleton / ServerPagination / TabGroup / Timeline / EmptyState / LikeButton / CommentButton / SidebarDialog
├─ shell/                     全站外壳：Navbar / Footer / Sidebar / TabBar / WallpaperSection / DropdownMenu / FloatingControls / ToastHost
├─ sidebar/                   侧栏卡片（纯卡片）：Profile / Announcement / Calendar / Categories / Tags / Welcome / SiteInfo
├─ controls/                  交互控件：Search / AdvancedSearch / FilterControls / ArchivePanel / FloatingControls / TOC / 设置
├─ managers/                  只装行为的运行时管理器：Fancybox / Katex / GithubCard / CodeGroup / FontManager
└─ mdx/                       MDX 文章组件出口（仅 index.ts 桶；图标在 ui/icons.ts）
```

## 约定

- 命名：组件 `PascalCase`；**`features/<domain>/` 里的 `.ts` 一律以领域名为前缀**（`comment-user.ts`、`dynamic-actions.ts`、`guestbook-tag.ts`），
  保证在全局搜索结果里能一眼看出它属于哪个功能。`mdx/index.ts` 是桶文件，`index` 本身即是例外。
- import 路径形态（别名 / 相对 / `import.meta.glob` 索引 / 迁移扫描）统一见
  [`docs/博客规范补充.md`](../../docs/博客规范补充.md) §1；本文件不再重述，避免两处走样。
- 组件只负责画。取数、请求、状态机放 `src/utils/` 或父组件；点赞统一走 `utils/likes.ts`，别再写第二份。
- **功能域之间只允许单向，且只能走对方的 `index.ts` 出口**（目前只有 `features/comment/` 有出口：`dynamic` 与 `guestbook` 都消费它）。
  出现 `a → b` 与 `b → a` 就是告警信号：多半是某个共享件被放错了域，应下沉到 `ui/`（纯 UI）或归到真正使用它的域。
  例：`dynamic-lottie-icon` 被三个域使用 → `ui/lottie-icon.ts`；评论抽屉依赖评论壁纸 → `features/comment/comment-drawer.ts`。
- 需要 `client:*` 水合的组件从具体文件直接 import，不要经过桶文件（否则水合判定拿不到真实组件模块）。
- 同目录**禁止同名不同扩展**（`X.astro` 与 `X.svelte` 并存会让编辑器自动导入选错）。
- 组件内 `<style>` 是 unlayered，优先级高于 `@layer utilities`；要压 Tailwind 的规则写在组件里。
- 领域目录暂不强制 `index.ts` 桶文件，只有被多处消费的（`mdx/`）才需要。
- 新增页面级组件：先问「它属于哪个领域」；`ui/` 只放不依赖站点数据的原子。
