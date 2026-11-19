/**
 * 阅读（导航子域）：微信读书书架、3D 书墙与阅读热力图。
 * 数据只在构建期由 pnpm books:refresh 落盘，运行时只读缓存。
 */

// 组件
export { default as BookPopover } from "./components/BookPopover.svelte";
export { default as Bookshelf3D } from "./components/Bookshelf3D.svelte";
export { default as ReadingHeatmap } from "./components/ReadingHeatmap.svelte";

// 配置
export { wereadConfig } from "./config";
export type { ScrollPlan } from "./lib/shelf-physics";

// 工具 / 契约
export { cubicBezier, planScroll } from "./lib/shelf-physics";
export type { CachedCallOptions, FetchOutcome } from "./lib/weread-cache";
export {
	cachedCall,
	clearWereadCache,
	DEFAULT_CACHE_DIR,
	makeCacheKey,
	resolveCacheDir,
	wereadCacheStats,
} from "./lib/weread-cache";
export type {
	WereadBook,
	WereadBookStatus,
	WereadCalendar,
	WereadData,
	WereadStats,
} from "./lib/weread-utils";
export {
	fetchWereadData,
	formatHours,
	formatMinutes,
} from "./lib/weread-utils";
// 类型
export type { WereadConfig } from "./types";
