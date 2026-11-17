# Components

目录名 = 领域。判断标准：**删掉某个功能，需要动几个目录** —— 理想是 1 个。

```
src/components/
├─ ui/          纯展示原子：AvatarImage / Badge / CoverImage / Icon / Skeleton / Pagination / TabGroup / Timeline / EmptyState …
├─ shell/       全站外壳：Navbar / Footer / SideBar / TabBar / WallpaperSection / DropdownMenu / ConfigCarrier / Banner*Overlay
├─ comment/     评论：Comment.astro + 顶栏/输入栏/表情/壁纸逻辑 + PostComments（文章页内嵌）
├─ post/        文章：PostCard / PostHeader / PostMeta / PostPage / PostStats / SeriesNav / License / ShareButton / Encrypted*
├─ dynamic/     动态：DynamicItem / DynamicFeed / DynamicGallery / 抽屉 / 图标元素 / 侧栏预览
├─ guestbook/   留言墙：GuestbookWall + GuestTag + 类型与配色
├─ media/       条目库：bangumi/ mal/ vndb/ bilibili/ gallery/ projects/
├─ books/       阅读：BookPop / Bookshelf3D / ReadingHeatmap
├─ music/       音乐：MusicPlayer / MusicManager / NowPlayingCard / PlaybackSettings / NavMusicButton / 侧栏 Music
├─ effects/     视觉特效：Sakura / Waves / Typewriter / Live2D / Spine / BackgroundPlayer / PioMessageBox
├─ stats/       统计与图表：SiteVisitCounter / PostViewCounter / SiteStats / PostActivity / CategoryRoseChart / TagBarChart
├─ sponsor/     打赏：SponsorButton / SponsorButtonLottie / SponsorPop
├─ sidebar/     侧栏卡片（纯卡片，无领域逻辑）：Profile / Announcement / Calendar / Categories / Tags / Welcome / SiteInfo / Advertisement / SidebarTOC
├─ controls/    交互控件：Search / AdvancedSearch / FilterControls / ArchivePanel / FloatingControls / TOC / 沉浸阅读 / 明暗切换 / 设置面板
├─ managers/    只装行为的运行时管理器：Fancybox / Katex / GithubCard / CodeGroup / FontSetup
└─ mdx/         MDX 文章组件出口（index.ts 桶 + icons.ts）
```

## 约定

- import 路径形态（别名 / 相对 / `import.meta.glob` 索引 / 迁移扫描）统一见
  [`docs/博客规范补充.md`](../../docs/博客规范补充.md) §1；本文件不再重述，避免两处走样。
- 组件只负责画。取数、请求、状态机放 `src/utils/` 或父组件；点赞统一走 `utils/likes.ts`，别再写第二份。
- 同目录**禁止同名不同扩展**（`X.astro` 与 `X.svelte` 并存会让编辑器自动导入选错）。
- 组件内 `<style>` 是 unlayered，优先级高于 `@layer utilities`；要压 Tailwind 的规则写在组件里。
- 领域目录暂不强制 `index.ts` 桶文件，只有被多处消费的（`mdx/`）才需要。
- 新增页面级组件：先问「它属于哪个领域」；`ui/` 只放不依赖站点数据的原子。
