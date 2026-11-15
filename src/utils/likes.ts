/**
 * 点赞：一个按钮、一份本地记录，文章和动态共用。
 * ---------------------------------------------------------------------------
 * 静态站没有点赞接口，所以「后端」目前就是这份 localStorage：键是通用的
 * `firefly-likes`，值是「点过赞的对象 id 集合」。文章用 slug，动态用
 * `dynamic-<id>`，两者不会撞。
 *
 * 旧键 `firefly-dynamic-likes` 只在动态拥有点赞时使用过，读的时候并进来，
 * 之后只写新键 —— 换键不能让用户已点的赞消失。
 *
 * 这里是点赞行为的唯一实现：LikeButton 组件只负责长什么样，DynamicActions
 * 只负责把抽屉的评论按钮接上。加新的点赞场景时，不要再写第二份。
 */
import { formatCompactNumber } from "@/utils/number-utils";

/** 当前键 */
const LIKES_KEY = "firefly-likes";
/** 旧键，只读，用来做一次性迁移 */
const LEGACY_KEY = "firefly-dynamic-likes";

/** like:change 的 detail：哪个对象、点成了什么样 */
export type LikeChangeDetail = { id: string; liked: boolean };

/** 已点赞的 id 集合 */
export function readLikedIds(): Set<string> {
	const ids = new Set<string>();
	for (const key of [LEGACY_KEY, LIKES_KEY]) {
		try {
			const raw = localStorage.getItem(key);
			if (!raw) continue;
			const parsed: unknown = JSON.parse(raw);
			if (!Array.isArray(parsed)) continue;
			for (const id of parsed) {
				if (typeof id === "string" && id) ids.add(id);
			}
		} catch {
			// 隐私模式读不出来、或者存的是坏 JSON：当成没有记录
		}
	}
	return ids;
}

function writeLikedIds(ids: Set<string>): void {
	try {
		localStorage.setItem(LIKES_KEY, JSON.stringify([...ids]));
		// 迁移完成后旧键就没用了；删不掉也不影响（读的时候会去重）
		localStorage.removeItem(LEGACY_KEY);
	} catch {
		// 隐私模式写不进去：这次点击仍有反馈，刷新后归位
	}
}

/** 翻转一次点赞，返回翻转后的状态 */
export function toggleLiked(id: string): boolean {
	const ids = readLikedIds();
	const liked = !ids.has(id);
	if (liked) ids.add(id);
	else ids.delete(id);
	writeLikedIds(ids);

	document.dispatchEvent(
		new CustomEvent<LikeChangeDetail>("like:change", { detail: { id, liked } }),
	);
	return liked;
}

/**
 * 按钮对应的 id。
 *
 * 文章页由组件直接给；动态卡片把 id 写在条目上，按钮是它的后代 —— 一条动态
 * 有多个按钮（卡片、侧栏各一份），所以两种来源都要认。
 */
export function likeIdOf(button: HTMLElement): string | null {
	if (button.dataset.likeId) return button.dataset.likeId;
	const host = button.closest<HTMLElement>("[data-like-id]");
	return host?.dataset.likeId || null;
}

/** 把一个按钮画成「已赞 / 未赞」，数字 = 基数 + 自己这一票 */
export function paintLikeButton(button: HTMLElement, liked: boolean): void {
	button.classList.toggle("is-active", liked);
	button.setAttribute("aria-pressed", String(liked));
	const count = button.querySelector<HTMLElement>("[data-like-count]");
	if (!count) return;
	const base = Number(button.dataset.likeBase ?? "") || 0;
	count.textContent = formatCompactNumber(base + (liked ? 1 : 0));
}

/** 把已点赞状态同步到（可能是新渲染出来的）按钮上 */
export function syncLikeStates(root: ParentNode = document): void {
	const ids = readLikedIds();
	root.querySelectorAll<HTMLElement>("[data-like]").forEach((button) => {
		const id = likeIdOf(button);
		paintLikeButton(button, Boolean(id) && ids.has(id as string));
	});
}

/** 播一次爱心动画：只在「点上」的时候弹，取消不弹 */
function playIcon(button: HTMLElement): void {
	button
		.querySelector<HTMLElement & { play?: () => void }>("dynamic-lottie-icon")
		?.play?.();
}

const BOUND_KEY = "__fireflyLikesBound";

/**
 * 注册一次即可（模块可能被多个岛实例化，用 window 标记去重）。
 *
 * 捕获阶段处理 + 阻止冒泡：按钮常嵌在整张卡片是链接的结构里，不拦下来会顺带
 * 触发卡片跳转。
 */
export function bindLikeButtons(): void {
	if (typeof window === "undefined") return;
	const scope = window as unknown as Record<string, boolean | undefined>;
	if (scope[BOUND_KEY]) {
		syncLikeStates();
		return;
	}
	scope[BOUND_KEY] = true;

	document.addEventListener(
		"click",
		(event) => {
			if (event.button !== 0) return;
			const target = event.target;
			if (!(target instanceof Element)) return;
			const button = target.closest<HTMLElement>("[data-like]");
			if (!button) return;
			const id = likeIdOf(button);
			if (!id) return;

			event.preventDefault();
			event.stopPropagation();

			const liked = toggleLiked(id);
			paintLikeButton(button, liked);
			if (liked) playIcon(button);
		},
		true,
	);

	syncLikeStates();
	document.addEventListener("astro:page-load", () => syncLikeStates());
}
