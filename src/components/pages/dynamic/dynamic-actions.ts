/**
 * 动态卡片底部操作条：点赞 / 评论
 * 用 document 级事件委托统一处理，动态页（模板克隆）与侧栏弹窗（Svelte）共用
 * - 点赞：纯本地记录（localStorage），静态站无后端
 * - 评论：展开/收起该条动态的内联评论
 */

const LIKES_KEY = "firefly-dynamic-likes";

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
		});
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
}

function toggleComments(button: HTMLElement): void {
	const entry = button.closest<HTMLElement>("[data-dynamic-entry]");
	const comments = entry?.querySelector<HTMLElement & { toggle?: () => void }>(
		"dynamic-inline-comments",
	);
	if (!comments?.toggle) return;
	comments.toggle();
	button.classList.toggle("is-active", comments.dataset.expanded === "true");
}

function onClick(event: MouseEvent): void {
	if (event.button !== 0) return;
	const target = event.target as Element | null;
	const button = target?.closest<HTMLElement>(
		"[data-dynamic-like], [data-dynamic-comment]",
	);
	if (!button) return;
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
export function registerDynamicActions(): void {
	if (registered) return;
	registered = true;
	document.addEventListener("click", onClick, true);
	syncDynamicLikeStates();
}
