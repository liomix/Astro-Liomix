/**
 * 点赞：服务端权威的一枚按钮，文章和动态共用
 * ---------------------------------------------------------------------------
 * 记录在后端（`/api/v1/posts/{slug}/likes`），键是 post slug：文章用自己的 slug，
 * 动态用 `dynamic-<id>`。所以「同一篇文章在不同设备上看到同一个数字」成立，
 * 不再像以前那样只存在本机 localStorage 里 —— 那种「点赞」换台设备就没了，
 * 别人也永远看不到。
 *
 * 这里只做三件事：
 *   1. 批量读一次快照，把数字画到按钮上（整页的 `[data-like]` 合并成一次请求）；
 *   2. 点击时先乐观画上（点赞是典型的「失败可判定、可回滚」场景），再用服务端
 *      返回的权威值覆盖；失败就回滚到点击前的样子，不留一个假的赞；
 *   3. 把变化以 `like:change` 事件广播出去，让页头统计之类的地方跟着重算。
 *
 * 长什么样不在这里：LikeButton 组件只管外观。加新的点赞场景时不要再写第二份。
 */

import { formatCompactNumber } from "@/shared/lib/format/number";
import {
	fetchLikeTallies,
	isLikeApiEnabled,
	likePost,
	unlikePost,
} from "./like-client";

/** like:change 的 detail：哪个对象、点成了什么样、现在几条 */
export type LikeChangeDetail = { id: string; liked: boolean; count: number };

/** 服务端快照：slug → 总数与「我点过没有」 */
type Tally = { count: number; liked: boolean };

const tallies = new Map<string, Tally>();
/** 正在批量读的 id，避免同一个 id 短时间内被问两遍 */
const pending = new Set<string>();
/** 本次页面已经问过的 id；换页（astro:page-load）时清空，让数字重新对齐后端 */
const fetched = new Set<string>();

/** 某个对象当前的点赞数；没读到过返回 undefined，调用方自己兜底 */
export function likeCountOf(id: string): number | undefined {
	return tallies.get(id)?.count;
}

/** 按钮对应的 id：文章页由组件直接给，动态卡片写在条目上 */
export function likeIdOf(button: HTMLElement): string | null {
	if (button.dataset.likeId) return button.dataset.likeId;
	const host = button.closest<HTMLElement>("[data-like-id]");
	return host?.dataset.likeId || null;
}

/** 把一个按钮画成「已赞 / 未赞」，数字用服务端的权威值 */
function paintLikeButton(button: HTMLElement, tally: Tally): void {
	button.classList.toggle("is-active", tally.liked);
	button.setAttribute("aria-pressed", String(tally.liked));
	const node = button.querySelector<HTMLElement>("[data-like-count]");
	if (node) node.textContent = formatCompactNumber(tally.count);
}

/** 播一次爱心动画：只在「点上」的时候弹，取消不弹 */
function playIcon(button: HTMLElement): void {
	button
		.querySelector<HTMLElement & { play?: () => void }>("dynamic-lottie-icon")
		?.play?.();
}

/** 用当前快照把 root 里所有按钮重画一遍 */
function repaintAll(root: ParentNode = document): void {
	for (const button of Array.from(
		root.querySelectorAll<HTMLElement>("[data-like]"),
	)) {
		const id = likeIdOf(button);
		const tally = id ? tallies.get(id) : undefined;
		if (tally) paintLikeButton(button, tally);
	}
}

/**
 * 批量读快照并刷新按钮。
 *
 * 粒度是整页：动态流一屏十几个按钮、文章页一个，都走同一个请求。分页/换页后会
 * 带着新的一批 id 再来一次，已经问过的跳过。
 */
async function loadTallies(ids: string[], signal?: AbortSignal): Promise<void> {
	const missing = ids.filter((id) => !pending.has(id) && !fetched.has(id));
	if (missing.length === 0) return;

	for (const id of missing) pending.add(id);
	try {
		const items = await fetchLikeTallies(missing, signal);
		for (const item of items) {
			tallies.set(item.slug, { count: item.count, liked: item.liked });
			fetched.add(item.slug);
		}
	} catch (error) {
		// 拿不到就保持按钮原样（显示数据源里的基数）。点赞是次要信息，
		// 不该因为它把页面搞成错误状态；下一次同步会重试。
		console.warn("[like] load tallies failed", error);
		return;
	} finally {
		for (const id of missing) pending.delete(id);
	}

	repaintAll();
	// 数字可能变了（别人也点过），让页头统计这类汇总重算一次
	document.dispatchEvent(
		new CustomEvent<{ ids: string[] }>("like:states", {
			detail: { ids: missing },
		}),
	);
}

/**
 * 把服务端状态同步到（可能是新渲染出来的）按钮上。
 *
 * 已经知道的 id 立刻画，不知道的合并成一次批量请求 —— 动态流克隆出十几张卡片时
 * 只发一个请求，而不是每个按钮一个。
 */
export function syncLikeStates(root: ParentNode = document): void {
	if (!isLikeApiEnabled() || typeof document === "undefined") return;

	const unknown = new Set<string>();
	for (const button of Array.from(
		root.querySelectorAll<HTMLElement>("[data-like]"),
	)) {
		const id = likeIdOf(button);
		if (!id) continue;
		const tally = tallies.get(id);
		if (tally) {
			paintLikeButton(button, tally);
			continue;
		}
		unknown.add(id);
	}
	if (unknown.size > 0) void loadTallies(Array.from(unknown));
}

/**
 * 点一下：先乐观画上，再拿服务端结果覆盖，失败回滚。
 *
 * 连点保护：请求没回来之前不再接受同一个按钮的第二次点击（16.4）。服务端幂等，
 * 所以即使真的并发了两枪，结果也还是一条赞。
 */
async function toggle(button: HTMLElement, id: string): Promise<void> {
	if (button.dataset.likeBusy === "true") return;

	const previous: Tally = tallies.get(id) ?? {
		count: Number(button.dataset.likeBase ?? "") || 0,
		liked: false,
	};
	const optimistic: Tally = {
		count: Math.max(0, previous.count + (previous.liked ? -1 : 1)),
		liked: !previous.liked,
	};

	tallies.set(id, optimistic);
	paintLikeButton(button, optimistic);
	if (optimistic.liked) playIcon(button);

	button.dataset.likeBusy = "true";
	try {
		const tally = optimistic.liked ? await likePost(id) : await unlikePost(id);
		// 服务端的值优先：别人可能同时点过，本地那个 +1 只是预估
		const authoritative: Tally = { count: tally.count, liked: tally.liked };
		tallies.set(id, authoritative);
		fetched.add(id);
		paintLikeButton(button, authoritative);
		document.dispatchEvent(
			new CustomEvent<LikeChangeDetail>("like:change", {
				detail: {
					id,
					liked: authoritative.liked,
					count: authoritative.count,
				},
			}),
		);
	} catch (error) {
		tallies.set(id, previous);
		paintLikeButton(button, previous);
		console.error("[like] toggle failed", id, error);
	} finally {
		delete button.dataset.likeBusy;
	}
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
			if (!isLikeApiEnabled()) return;
			const target = event.target;
			if (!(target instanceof Element)) return;
			const button = target.closest<HTMLElement>("[data-like]");
			if (!button) return;
			const id = likeIdOf(button);
			if (!id) return;

			// 卡片是整块链接，按钮在它里面：不拦住就会顺带跳转
			event.preventDefault();
			event.stopPropagation();

			void toggle(button, id);
		},
		true,
	);

	syncLikeStates();

	document.addEventListener("astro:page-load", () => {
		// 换页之后数字可能已经变了（别处点的赞），把「问过」清掉重新对齐
		fetched.clear();
		syncLikeStates();
	});
}
