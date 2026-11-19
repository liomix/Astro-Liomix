/**
 * 留言墙（导航子域）：页面外壳 + 便签墙 UI。评论实现消费 shared/lib/comments。
 */

export { default as GuestbookWall } from "./components/GuestbookWall.svelte";
// 组件
export { default as GuestTag } from "./components/GuestTag.svelte";
export type { GuestTagItem } from "./lib/guest-tag";
// 工具 / 契约
export {
	GUEST_TAG_TONES,
	likeSlugOfGuestTag,
	toneOfGuestTag,
} from "./lib/guest-tag";
