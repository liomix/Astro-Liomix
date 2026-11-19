/**
 * 评论（横切能力）的对外出口。
 * ---------------------------------------------------------------------------
 * 文章页、动态页、留言墙都消费这里的能力，但没有任何一个域拥有它 ——
 * 它挂在 target 上（文章 / 动态 / 留言墙），没有独立页面，所以不是域。
 *
 * 约束：
 *   1. 需要 `client:*` 水合的组件请在页面里直接 import 具体文件，不要经过这个桶；
 *   2. 组件名保持中性（不出现 Post/Article 字样），业务差异靠 targetType 传参；
 *   3. 不要在这里 `export *`：出口是契约，不是文件清单。
 */

// 抽屉（iframe 外壳）
export {
	bindCommentDrawer,
	closeCommentDrawer,
	openCommentDrawer,
	scheduleDrawerWarm,
} from "@/shared/lib/comments/comment-drawer";
// 本设备的评论凭据（决定是否显示「删除」）
export {
	deleteTokenOf,
	forgetOwnComment,
	identityKeyOf,
	readOwnComments,
	readOwnIdentities,
	rememberOwnComment,
} from "@/shared/lib/comments/comment-own";
export type {
	AvatarGradient,
	CommentUser,
} from "@/shared/lib/comments/comment-user";
// 评论者身份（昵称 / 邮箱）
export {
	avatarGradientOf,
	avatarUrlOf,
	COMMENT_EMAIL_MAX,
	COMMENT_NAME_MAX,
	COMMENT_USER_STORAGE_KEY,
	getCommentUser,
	initialOf,
	isValidEmail,
	isValidName,
	qqAvatarFallbackUrl,
	qqAvatarUrl,
	qqFromEmail,
	setCommentUser,
	watchCommentUserStorage,
} from "@/shared/lib/comments/comment-user";
// 组件
export { default as Comment } from "./Comment.astro";
export { default as CommentButton } from "./CommentButton.astro";
export { default as CommentSection } from "./CommentSection.astro";
export { default as CommentSkeleton } from "./CommentSkeleton.astro";
