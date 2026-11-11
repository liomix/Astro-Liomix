/**
 * 动态卡片底部操作条：点赞 / 评论
 * 用 document 级事件委托统一处理，动态页（模板克隆）与侧栏弹窗（Svelte）共用
 * - 点赞：纯本地记录（localStorage），静态站无后端
 * - 评论：从右侧抽出评论抽屉（CommentDrawer），见 dynamic-comment-drawer.ts
 */

import {
	bindCommentDrawer,
	closeCommentDrawer,
	openCommentDrawer,
} from "@/components/pages/dynamic/dynamic-comment-drawer";
import { registerDynamicLottieIcons } from "@/components/pages/dynamic/dynamic-lottie-icon";
import { formatCompactNumber } from "@/utils/number-utils";

const LIKES_KEY = "firefly-dynamic-likes";

/**
 * 这个模块同时被动态流和侧栏弹窗两个岛 import，dev 下 Vite 有机会把它实例化两份。
 * 只用模块内的布尔量挡不住 —— 两份各挂一个捕获监听，点一次会连续点赞 + 取消，
 * 表现就是「点了没反应」。所以再用一个挂在 window 上的标记做全局去重。
 */
const BOUND_KEY = "__fireflyDynamicActionsBound";

let registered = false;

function readLikes(): Set<string> {
	try {
		const raw = localStorage.getItem(LIKES_KEY);
		if (!raw) return new Set();
		const parsed: unknown = JSON.parse(raw);
		return new Set(
			Array.isArray(parsed)
				? parsed.filter((item): item is string => typeof item === "string")
				: [],
		);
	} catch {
		return new Set();
	}
}

function writeLikes(likes: Set<string>): void {
	try {
		localStorage.setItem(LIKES_KEY, JSON.stringify([...likes]));
	} catch {
		// 隐私模式下写入会抛错，忽略即可
	}
}

function likeId(element: Element): string | null {
	const host = element.closest<HTMLElement>("[data-like-id]");
	return host?.dataset.likeId || null;
}

/**
 * 点赞数：`data-like-base`（服务端可预置的基数，默认 0）+ 自己这一票。
 * 静态站没有后端，这里就是个本地计数，数字只是让按钮不至于空着。
 */
function paintLikeCount(button: HTMLElement, liked: boolean): void {
	const node = button.querySelector<HTMLElement>("[data-dynamic-like-count]");
	if (!node) return;
	const base = Number(button.dataset.likeBase ?? "") || 0;
	node.textContent = formatCompactNumber(base + (liked ? 1 : 0));
}

/** 评论数：评论系统接上后才会有真实数字，现在按 data-comment-base 预置（默认 0） */
function paintCommentCount(button: HTMLElement): void {
	const node = button.querySelector<HTMLElement>("[data-dynamic-comment-count]");
	if (!node) return;
	const base = Number(button.dataset.commentBase ?? "") || 0;
	node.textContent = formatCompactNumber(base);
}

/** 播一次图标动画：点赞是爱心弹出 + 粒子，评论是气泡 */
function playIcon(button: HTMLElement): void {
	button
		.querySelector<HTMLElement & { play?: () => void }>("dynamic-lottie-icon")
		?.play?.();
}

/** 把已点赞状态同步到（新渲染出来的）按钮上 */
export function syncDynamicLikeStates(root: ParentNode = document): void {
	const likes = readLikes();
	root
		.querySelectorAll<HTMLElement>("[data-dynamic-like]")
		.forEach((button) => {
			const id = likeId(button);
			const liked = Boolean(id) && likes.has(id as string);
			button.classList.toggle("is-active", liked);
			button.setAttribute("aria-pressed", String(liked));
			paintLikeCount(button, liked);
		});
	// 评论数不依赖点赞状态，单独刷一遍（模板克隆出来的条目初始只有占位 0）
	root
		.querySelectorAll<HTMLElement>("[data-dynamic-comment]")
		.forEach((button) => paintCommentCount(button));
}

function toggleLike(button: HTMLElement): void {
	const id = likeId(button);
	if (!id) return;
	const likes = readLikes();
	if (likes.has(id)) likes.delete(id);
	else likes.add(id);
	writeLikes(likes);
	const liked = likes.has(id);
	button.classList.toggle("is-active", liked);
	button.setAttribute("aria-pressed", String(liked));
	paintLikeCount(button, liked);
	if (liked) playIcon(button);
}

function toggleComments(button: HTMLElement): void {
	// 评论地址挂在条目上（由 SSR 或模板克隆时写入）；本站没接评论服务时为空，
	// 那时抽屉照样抽出，里面给一句「评论系统未配置」的空态
	const entry = button.closest<HTMLElement>("[data-dynamic-entry]");
	if (!entry) return;
	// 已经贴着这条动态打开着 → 收起；否则（含切到另一条）打开并换内容
	if (button.classList.contains("is-active")) {
		closeCommentDrawer();
		return;
	}
	playIcon(button);
	openCommentDrawer(
		entry.dataset.commentSrc ?? "",
		button,
		entry.dataset.commentEmpty ?? "",
	);
}

function onClick(event: MouseEvent): void {
	if (event.button !== 0) return;
	const target = event.target as Element | null;
	const button = target?.closest<HTMLElement>(
		"[data-dynamic-like], [data-dynamic-comment]",
	);
	if (!button) return;
	// 同一个事件只处理一次：万一模块被实例化两份、挂了两个监听，
	// 点赞会「点一次等于点两次」（加了又删），表现就是点了没反应
	const flags = event as MouseEvent & { __dynamicActionHandled?: boolean };
	if (flags.__dynamicActionHandled) return;
	flags.__dynamicActionHandled = true;

	// 按钮可能嵌在卡片内，阻止冒泡以免触发上层的链接/路由
	event.preventDefault();
	event.stopPropagation();

	if (button.hasAttribute("data-dynamic-like")) {
		toggleLike(button);
		return;
	}
	if (button.hasAttribute("data-dynamic-comment")) {
		toggleComments(button);
	}
}

/** 注册一次即可，在动态页与侧栏弹窗里都可调用 */
export function registerDynamicActions(
	options: {
		commentCloseLabel?: string;
		commentName?: string;
		commentAvatarUrl?: string;
	} = {},
): void {
	// 抽屉的关闭文案、聊天对象名字与头像由页面侧传入，
	// 先写进去再判断是否已绑定（同一页面换文章时也要刷新）
	bindCommentDrawer({
		closeLabel: options.commentCloseLabel,
		name: options.commentName,
		avatarUrl: options.commentAvatarUrl,
	});

	if (registered) return;
	registered = true;

	const scope = window as unknown as Record<string, boolean | undefined>;
	if (scope[BOUND_KEY]) return;
	scope[BOUND_KEY] = true;

	registerDynamicLottieIcons();
	document.addEventListener("click", onClick, true);
	syncDynamicLikeStates();
}
