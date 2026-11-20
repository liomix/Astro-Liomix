/**
 * 动态域：动态列表、卡片、图集、评论抽屉入口与预览。
 * 不负责：评论/点赞实现（shared 能力），只消费。
 */

// 组件
export { default as DynamicActionBar } from "./components/DynamicActionBar.astro";
export { default as DynamicFeed } from "./components/DynamicFeed.svelte";
export { default as DynamicGallery } from "./components/DynamicGallery.astro";
export { default as DynamicItemTemplate } from "./components/DynamicItemTemplate.astro";
export { default as DynamicPreview } from "./components/DynamicPreview.astro";
export { default as DynamicSidebar } from "./components/DynamicSidebar.svelte";

// 配置
export { dynamicConfig } from "./config";
// 工具 / 契约
export {
	registerDynamicActions,
	syncDynamicLikeStates,
} from "./lib/dynamic-actions";
export { registerDynamicGallery } from "./lib/dynamic-gallery";
export {
	dynamicAnchor,
	dynamicPlainText,
	dynamicSearchText,
	dynamicSlug,
	sortDynamics,
} from "./lib/dynamic-utils";
// 类型
export type { DynamicConfig } from "./types";
