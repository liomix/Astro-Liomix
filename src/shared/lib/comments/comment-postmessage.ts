/**
 * 评论的 postMessage 协议（父窗口 ↔ iframe）
 * ---------------------------------------------------------------------------
 * 两端靠字符串约定通信，没有类型系统保护 —— 改一个 `type` 就静默断链。
 * 所以常量放在这里，两端 import 同一份；并在单测里钉住字符串与版本号。
 *
 * 规则（规范 §5.6）：
 *   1. 消息体必带 `type` 与 `version`；
 *   2. 接收方精确校验 `event.origin`（不用 includes）与 `event.source`；
 *   3. 协议只增不改。破坏性变更时升 `COMMENT_MSG_VERSION`，
 *      并同时兼容旧版本至少一个发布周期。
 */

export const COMMENT_MSG = {
	/** 父 → iframe：站点明暗 + 主题色相 */
	theme: "dynamic-comment-theme",
	/** 父 → iframe：要显示哪条线程（?path= 的路径） */
	path: "dynamic-comment-path",
	/** 父 → iframe：评论抽屉的壁纸 id */
	wallpaper: "dynamic-comment-wallpaper",
	/** iframe → 父：请求收起抽屉 */
	close: "dynamic-comment-close",
	/** 留言墙 iframe → 父：请求父留言内容 */
	parentRequest: "guest-parent-request",
	/** 父 → 留言墙 iframe：父留言内容 */
	parent: "guest-parent",
} as const;

/** 当前协议版本。旧消息没有 version 字段，按 v1 处理。 */
export const COMMENT_MSG_VERSION = 1;

export type CommentMessageType = (typeof COMMENT_MSG)[keyof typeof COMMENT_MSG];

export type CommentMessage =
	| {
			type: typeof COMMENT_MSG.theme;
			version: typeof COMMENT_MSG_VERSION;
			dark: boolean;
			hue?: string;
	  }
	| {
			type: typeof COMMENT_MSG.path;
			version: typeof COMMENT_MSG_VERSION;
			path: string;
	  }
	| {
			type: typeof COMMENT_MSG.wallpaper;
			version: typeof COMMENT_MSG_VERSION;
			id: string;
	  }
	| {
			type: typeof COMMENT_MSG.close;
			version: typeof COMMENT_MSG_VERSION;
	  }
	| {
			type: typeof COMMENT_MSG.parentRequest;
			version: typeof COMMENT_MSG_VERSION;
	  }
	| {
			type: typeof COMMENT_MSG.parent;
			version: typeof COMMENT_MSG_VERSION;
			parent: unknown;
	  };
