/**
 * 评论抽屉（CommentDrawer）
 * ---------------------------------------------------------------------------
 * 点动态卡片底部的评论按钮，从屏幕右侧抽出一列抽屉：上下左右正好盖住右侧栏
 * 那两张卡片（几何由 fitGeometry 实测），内容仍是
 * `/dynamic/comments/` 这个独立页面，用 iframe 装 —— 评论服务（waline /
 * twikoo / giscus…）自成一套 DOM 与样式，塞进主文档会互相污染。
 *
 * 这里**只管外壳**：位置、尺寸、滑入滑出、焦点、开合时机。
 * 抽屉里的内容（壁纸、顶栏、消息区、输入栏）全在 iframe 自己的文档里。这是刻意的：
 * 顶栏与输入栏要「壁纸的高斯模糊」，而 backdrop-filter 只能采样**同一个 document**
 * 里画在它下面的东西 —— 壁纸必须在内容那一侧画，父窗口替不了。反过来说，父窗口也
 * 不用再指望 iframe 透明（那本来就不是标准能力），它只要把 iframe 摆对位置。
 *
 * 收起权留在这一侧：iframe 里的关闭按钮和 Esc 只是 postMessage 一条消息过来。
 *
 * 为什么由 JS 创建、挂到 <body> 上：
 *   1. 动态页条目是 SSR 静态 HTML + 模板克隆，每条渲染一个抽屉＝几十个隐藏
 *      iframe，只有点开的那条才需要；
 *   2. #content-wrapper 入场动画带 transform，transform 祖先会让 position:fixed
 *      相对祖先定位而不是视口，挂 body 才稳。
 */

import { CHAT_WALLPAPER_SRC } from "@/components/pages/dynamic/comment-wallpaper";

const BOUND_KEY = "__fireflyCommentDrawerBound";

let activeTrigger: HTMLElement | null = null;
let frame: HTMLIFrameElement | null = null;
let themeObserver: MutationObserver | null = null;
let prefetched = false;

function getDrawer(): HTMLElement | null {
	return document.querySelector<HTMLElement>("[data-comment-drawer]");
}

function syncFrameTheme(): void {
	const win = frame?.contentWindow;
	if (!win) return;
	// 主题色相也一起带过去：iframe 是独立文档，父窗口改 --hue 它自己看不到
	const hue = getComputedStyle(document.documentElement)
		.getPropertyValue("--hue")
		.trim();
	win.postMessage(
		{
			type: "dynamic-comment-theme",
			dark: document.documentElement.classList.contains("dark"),
			hue,
		},
		window.location.origin,
	);
}

/** 跟随站点明暗 / 主题色切换（documentElement 的 class 与内联 style 变化） */
function observeTheme(): void {
	if (themeObserver) return;
	themeObserver = new MutationObserver(() => {
		if (frame) syncFrameTheme();
	});
	// --hue 是脚本用 style.setProperty 写进 <html> 的行内样式，所以 style 也要监听
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class", "style"],
	});
}

/**
 * 几何对齐右侧栏那两张卡片：
 *   - 右边缘直接贴视口边缘、宽度 = 右栏左边缘到视口右边缘。不能只取右栏列宽
 *     （那样右边会空出 #main-grid 的 1rem 内边距，右下角 home / 齿轮两个浮动按钮
 *     正好落在那条缝里，从抽屉旁边露出来）；
 *   - 顶边对齐公告卡片：用「文档坐标」而不是当前 rect.top —— 用户往下滚一段再点评论时，
 *     卡片早已滚出视口，直接照抄会得到负数、抽屉一路贴到屏幕顶端紧贴导航栏；
 *     rect.top + scrollY 是卡片在页面顶部时相对视口的位置，滚动多少都不变；
 *   - 顶边上限压到视口 45%（有 banner 时卡片可能在视口下方很远），免得抽屉被压扁。
 * 右栏不显示时（窄屏 / 本站关侧栏）撤掉变量，交给 CSS 兜底。
 */
function fitGeometry(drawer: HTMLElement): void {
	// 窄屏右栏本来就不显示（有的是挪到底部），别去量它，直接交给 CSS 的 100vw 兜底
	const desktop = window.matchMedia("(min-width: 768px)").matches;
	const sidebar = desktop
		? document.querySelector<HTMLElement>("#right-sidebar")
		: null;
	const rect = sidebar?.getBoundingClientRect();
	if (!rect || rect.width <= 0) {
		drawer.style.removeProperty("--comment-drawer-width");
		drawer.style.removeProperty("--comment-drawer-top");
		return;
	}

	const viewport = document.documentElement.clientWidth;
	drawer.style.setProperty(
		"--comment-drawer-width",
		`${Math.round(viewport - rect.left)}px`,
	);

	const maxTop = Math.max(8, Math.round(window.innerHeight * 0.45));
	const top = Math.min(
		Math.max(Math.round(rect.top + window.scrollY), 8),
		maxTop,
	);
	drawer.style.setProperty("--comment-drawer-top", `${top}px`);
}

function createDrawer(): HTMLElement {
	const drawer = document.createElement("aside");
	drawer.className = "comment-drawer";
	drawer.dataset.commentDrawer = "true";
	drawer.dataset.open = "false";
	drawer.setAttribute("role", "dialog");
	drawer.setAttribute("aria-modal", "false");
	drawer.setAttribute("aria-hidden", "true");
	drawer.setAttribute("inert", "");
	// 里面只有 iframe：外壳不承担任何内容，装饰与圆角全在 CSS 里
	drawer.innerHTML = `<div class="comment-drawer-body" data-comment-drawer-body></div>`;

	document.body.append(drawer);
	return drawer;
}

/** 打开（或切换到另一条动态）：已打开时只换内容，不重播抽屉动画 */
export function openCommentDrawer(
	src: string,
	trigger: HTMLElement,
	emptyText = "",
): void {
	if (typeof document === "undefined") return;

	const existing = getDrawer();
	const drawer = existing ?? createDrawer();
	const body = drawer.querySelector<HTMLElement>("[data-comment-drawer-body]");
	if (!body) return;

	if (src) {
		if (!frame?.isConnected) {
			frame = document.createElement("iframe");
			frame.className = "comment-drawer-frame";
			// 只在点开时才创建，没必要 lazy（隐藏容器里的 lazy iframe 会拖到滑出来才加载）
			frame.setAttribute("allow", "clipboard-write");
			frame.addEventListener("load", syncFrameTheme);
			body.replaceChildren(frame);
		}
		frame.title = trigger.getAttribute("aria-label") || "Comments";
		if (frame.dataset.src !== src) {
			frame.dataset.src = src;
			frame.src = src;
		}
	} else {
		// 本站没接评论服务：抽屉照常抽出，里面给一句空态，而不是点了没反应
		const empty = document.createElement("p");
		empty.className = "comment-drawer-empty";
		empty.textContent = emptyText;
		body.replaceChildren(empty);
	}

	const label = trigger.getAttribute("aria-label") || "";
	if (label) drawer.setAttribute("aria-label", label);

	fitGeometry(drawer);
	const wasOpen = drawer.dataset.open === "true";
	activeTrigger?.classList.remove("is-active");
	activeTrigger?.setAttribute("aria-expanded", "false");
	activeTrigger = trigger;
	trigger.classList.add("is-active");
	trigger.setAttribute("aria-expanded", "true");

	drawer.removeAttribute("inert");
	drawer.setAttribute("aria-hidden", "false");
	// 关闭按钮在 iframe 里，父窗口这边能给的就是 iframe 本身：焦点落在文档边界上，
	// Tab 自然进到聊天界面，又不会像聚焦输入框那样弹起移动端键盘。
	// 从收起变展开时才抢焦点；在两条动态之间切换不抢，避免打断阅读
	const focusInside = () => {
		if (wasOpen) return;
		frame?.focus({ preventScroll: true });
	};
	if (existing) {
		drawer.dataset.open = "true";
		focusInside();
		return;
	}
	// 刚插进 DOM 的元素与 data-open 同帧写入不会触发过渡，推到下一帧
	requestAnimationFrame(() => {
		if (activeTrigger !== trigger) return;
		drawer.dataset.open = "true";
		focusInside();
	});
}

export function closeCommentDrawer(restoreFocus = true): void {
	const drawer = getDrawer();
	const trigger = activeTrigger;
	activeTrigger = null;
	trigger?.classList.remove("is-active");
	trigger?.setAttribute("aria-expanded", "false");

	if (!drawer || drawer.dataset.open !== "true") return;
	drawer.dataset.open = "false";
	drawer.setAttribute("inert", "");
	drawer.setAttribute("aria-hidden", "true");
	if (restoreFocus && trigger?.isConnected) {
		trigger.focus({ preventScroll: true });
	}
}

/** 点抽屉以外的地方收起（评论按钮本身的点击在捕获阶段就被接管了，不会走到这里） */
function onOutsideClick(event: MouseEvent): void {
	if (event.button !== 0) return;
	const drawer = getDrawer();
	if (!drawer || drawer.dataset.open !== "true") return;
	const target = event.target as Node | null;
	if (!target || drawer.contains(target)) return;
	closeCommentDrawer(false);
}

/** iframe 里的「关闭」按钮 / Esc 走这里 */
function onFrameMessage(event: MessageEvent): void {
	if (event.origin !== window.location.origin) return;
	if (event.data?.type !== "dynamic-comment-close") return;
	closeCommentDrawer();
}

function onKeydown(event: KeyboardEvent): void {
	if (event.key !== "Escape") return;
	const drawer = getDrawer();
	if (!drawer || drawer.dataset.open !== "true") return;
	event.stopPropagation();
	closeCommentDrawer();
}

function onResize(): void {
	const drawer = getDrawer();
	if (drawer && drawer.dataset.open === "true") fitGeometry(drawer);
}

/**
 * 悬浮 / 聚焦到评论按钮时先发一条 prefetch 提示：2.2MB 的壁纸 JSON 别等
 * 打开抽屉才开始下。只发一次，重复调用无副作用。
 */
function prefetchWallpaper(): void {
	if (prefetched) return;
	prefetched = true;
	const link = document.createElement("link");
	link.rel = "prefetch";
	link.as = "fetch";
	link.href = CHAT_WALLPAPER_SRC;
	document.head.append(link);
}

function onIntent(event: Event): void {
	const target = event.target as Element | null;
	if (!target?.closest("[data-dynamic-comment]")) return;
	prefetchWallpaper();
	document.removeEventListener("pointerover", onIntent);
	document.removeEventListener("focusin", onIntent);
}

export function bindCommentDrawer(): void {
	if (typeof window === "undefined") return;

	const scope = window as unknown as Record<string, boolean | undefined>;
	if (scope[BOUND_KEY]) return;
	scope[BOUND_KEY] = true;

	observeTheme();
	document.addEventListener("click", onOutsideClick);
	document.addEventListener("keydown", onKeydown);
	document.addEventListener("pointerover", onIntent, { passive: true });
	document.addEventListener("focusin", onIntent);
	window.addEventListener("resize", onResize, { passive: true });
	window.addEventListener("message", onFrameMessage);
	// 切页时抽屉 DOM 会被 Swup 换掉，顺手把状态清干净
	document.addEventListener("swup:visit:start", () =>
		closeCommentDrawer(false),
	);
}
