/**
 * 文章域：文章卡片、头部、目录、系列导航、加密正文与打赏。
 * 不负责：评论与点赞（在 shared/lib 的横切能力里）、页面取数（在 pages/ 里）。
 */

export type { PostOrderKey } from "@/shared/lib/content/post-order";
export {
	comparePostOrder,
	toPostOrderKey,
} from "@/shared/lib/content/post-order";
// 组件
export { default as EncryptedContent } from "./components/EncryptedContent.astro";
export { default as EncryptedPost } from "./components/EncryptedPost.astro";
export { default as FloatingTOC } from "./components/FloatingTOC.astro";
export { default as ImmersiveReading } from "./components/ImmersiveReading.astro";
export { default as ImmersiveTOC } from "./components/ImmersiveTOC.astro";
export { default as License } from "./components/License.astro";
export { default as PostCard } from "./components/PostCard.astro";
export { default as PostHeader } from "./components/PostHeader.astro";
export { default as PostMeta } from "./components/PostMeta.astro";
export { default as PostPage } from "./components/PostPage.astro";
export { default as PostStats } from "./components/PostStats.astro";
export { default as RecommendedPost } from "./components/RecommendedPost.astro";
export { default as SeriesNav } from "./components/SeriesNav.astro";
export { default as ShareButton } from "./components/ShareButton.svelte";
export { default as SponsorButton } from "./components/sponsor/SponsorButton.astro";
export { default as SponsorButtonLottie } from "./components/sponsor/SponsorButtonLottie.svelte";
export { default as SponsorDialog } from "./components/sponsor/SponsorDialog.svelte";
export { default as TocCard } from "./components/TocCard.astro";
// 配置
export { postConfig } from "./config";
// 工具 / 契约
export { encryptContent } from "./lib/crypto-utils";
export { initImmersiveReading } from "./lib/immersive-reading";
export type {
	PostPagePayload,
	PostPagePayloadInput,
} from "./lib/post-page-data";
export { buildPostPagePayload, directImageUrl } from "./lib/post-page-data";
export type { TocInput, TocItem } from "./lib/toc-shared";
export {
	computeTocItems,
	escapeHtmlAttr,
	renderBadgeInnerHTML,
	renderTocItemHTML,
} from "./lib/toc-shared";
export type { TOCConfig } from "./lib/toc-utils";
export { isPostPage, TOCManager } from "./lib/toc-utils";
// 类型
export type {
	ArticlePurityConfig,
	CoverImageConfig,
	ImmersiveReadingConfig,
	LicenseConfig,
	SponsorConfig,
} from "./types";
