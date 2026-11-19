/**
 * 统计域：站点访问量、文章阅读量与两个图表。
 * 数据来源是自建 API，客户端失败时整块隐藏，不影响正文。
 */

export type { PostViews, SiteStats } from "./client";
// 工具 / 契约
export {
	fetchPostViews,
	fetchSiteStats,
	getVisitorId,
	reportPostView,
	reportSiteVisit,
} from "./client";
// 组件
export { default as CategoryRoseChart } from "./components/CategoryRoseChart.svelte";
export { default as PostActivity } from "./components/PostActivity.astro";
export { default as PostViewCounter } from "./components/PostViewCounter.astro";
export { default as SiteStatsCard } from "./components/SiteStatsCard.astro";
export { default as SiteVisitCounter } from "./components/SiteVisitCounter.astro";
export { default as TagBarChart } from "./components/TagBarChart.astro";
// 配置
export { siteStatsConfig } from "./config";
// 类型
export type { SiteStatsConfig } from "./types";
