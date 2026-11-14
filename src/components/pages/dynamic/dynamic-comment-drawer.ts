/**
 * 评论抽屉（CommentDrawer）
 * ---------------------------------------------------------------------------
 * 点动态卡片底部的评论按钮，从屏幕右侧抽出一列抽屉：上下左右正好盖住右侧栏
 * 那两张卡片（几何由 fitGeometry 实测），内容仍是
 * `/dynamic/comments/` 这个独立页面，用 iframe 装 —— 评论区自成一套 DOM
 * 与样式（壁纸、顶栏、消息区、输入栏），塞进主文档会互相污染。
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

import {
	getChatWallpaperSrc,
	getChatWallpaperTint,
} from "@/components/pages/dynamic/comment-wallpaper";
import { getStoredCommentWallpaper } from "@/utils/setting-utils";

const BOUND_KEY = "__fireflyCommentDrawerBound";

let activeTrigger: HTMLElement | null = null;
let frame: HTMLIFrameElement | null = null;
let themeObserver: MutationObserver | null = null;
let prefetchLink: HTMLLinkElement | null = null;

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
		// 外壳垫底色跟着深浅走：切到深色要撤掉浅色垫底，否则抽屉会先亮一下
		const drawer = getDrawer();
		if (drawer) paintDrawerTint(drawer);
		if (frame) syncFrameTheme();
	});
	// --hue 是脚本用 style.setProperty 写进 <html> 的行内样式，所以 style 也要监听
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class", "style"],
	});
}

/**
 * 把「当前是哪条动态」转给 iframe。
 *
 * 抽屉里装的永远是同一个预渲染页面（/dynamic/comments/），消息目前是内置示例，
 * 地址里的 path 只作标记（评论页会写到 [data-tg-chat] 的 dataset 上，等接真实
 * 数据源时才用它去查）。所以换一条动态看评论**不需要**重新加载文档 ——
 * 重设 src 等于把整页连同几 MB 的壁纸 JSON 再走一遍，那几百毫秒就是白屏。
 */
function syncFramePath(src: string): void {
	const win = frame?.contentWindow;
	if (!win) return;
	let path = "";
	try {
		path = new URL(src, window.location.origin).searchParams.get("path") || "";
	} catch {
		path = "";
	}
	win.postMessage(
		{ type: "dynamic-comment-path", path },
		window.location.origin,
	);
}

/**
 * 把访客在「设置 → 壁纸」里选中的那张转给 iframe。
 * 壁纸画在 iframe 自己的文档里（顶栏 / 输入栏的毛玻璃要从它上面采样），
 * 父窗口碰不到它的 DOM，只能递个 id 过去让它自己换。
 */
function syncFrameWallpaper(): void {
	const win = frame?.contentWindow;
	if (!win) return;
	win.postMessage(
		{
			type: "dynamic-comment-wallpaper",
			id: getStoredCommentWallpaper(),
		},
		window.location.origin,
	);
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

/**
 * 建（或复用）iframe，但不打开抽屉。
 * 评论页是独立文档，壁纸要等它加载完、画完末帧才出现。真正点开的那一刻才建 iframe，
 * 看到的就是「抽屉先滑出来、壁纸后出现」；所以要把这层提前建好：
 *   - 悬浮 / 聚焦到评论按钮时（onIntent）；
 *   - 页面空闲时（scheduleDrawerWarm，覆盖触屏 / 键盘 / 手快连点这些没有悬浮的路径）。
 * 抽屉在关闭态是 visibility: hidden，装着 iframe 也看不见。
 */
function ensureFrame(src: string): HTMLIFrameElement | null {
	if (frame?.isConnected) return frame;
	const body = (getDrawer() ?? createDrawer()).querySelector<HTMLElement>(
		"[data-comment-drawer-body]",
	);
	if (!body) return null;

	const next = document.createElement("iframe");
	next.className = "comment-drawer-frame";
	next.setAttribute("allow", "clipboard-write");
	next.dataset.src = src;
	next.src = src;
	next.addEventListener("load", () => {
		// 加载完才允许「换动态只递 path」：没加载完的话改 src 只是提前跳转，不算重载
		next.dataset.loaded = "true";
		syncFrameTheme();
		syncFrameWallpaper();
		// 加载期间可能已经切到另一条动态（dataset.src 已经更新）：以它为准补一次
		syncFramePath(next.dataset.src || next.src);
	});
	body.replaceChildren(next);
	frame = next;
	return next;
}

/**
 * 抽屉外壳自己的垫底色。
 * iframe 里的文档还没到之前，这一层（以及 iframe 元素本身）就是唯一的可见面 ——
 * 它默认吃卡片底色，浅色下近白，冷启动那一下看起来就是白屏。
 * 换成这张壁纸的主色之后，即便真赶上冷启动，露出来的也是壁纸的色调。
 * 深色下不写：卡片底色本来就是深的，而浅色垫底会把整块照亮。
 */
function paintDrawerTint(drawer: HTMLElement): void {
	const tint = document.documentElement.classList.contains("dark")
		? ""
		: getChatWallpaperTint(getStoredCommentWallpaper());
	if (tint) drawer.style.setProperty("--comment-drawer-tint", tint);
	else drawer.style.removeProperty("--comment-drawer-tint");
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
	// 建出来就把垫底色定好：等用户点开时 iframe 可能还在路上，先别露卡片底色
	paintDrawerTint(drawer);

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
		// 通常已经预热过了（悬浮 / 空闲时建好）；这里只是兜底，即真的冷启动
		const target = ensureFrame(src);
		if (target) {
			target.title = trigger.getAttribute("aria-label") || "Comments";
			// 预热的那条和这条不是同一条动态。已经加载完的只把 path 递过去 ——
			// 抽屉里是同一个预渲染页面，重设 src 只会白白把整页重载一遍（白屏几百毫秒）；
			// 还在加载中的才允许改地址，那是提前跳转，不算重载
			if (target.dataset.src !== src) {
				target.dataset.src = src;
				if (target.dataset.loaded === "true") syncFramePath(src);
				else target.src = src;
			}
		}
		// iframe 一直留在页面上（收起只是移出视口）：切页后回来、或期间在设置里
		// 换了壁纸，都要再对一次，不然抽屉里还是上次那张
		syncFrameWallpaper();
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
 * 悬浮 / 聚焦到评论按钮时先发一条 prefetch 提示：几 MB 的壁纸 JSON 别等
 * 打开抽屉才开始下。换过壁纸之后同一个 <link> 改 href 重新预热，不重复插标签。
 */
function prefetchWallpaper(): void {
	// 预热的是当前选中的那张：预热别的等于白下几 MB
	const href = getChatWallpaperSrc(getStoredCommentWallpaper());
	if (prefetchLink) {
		if (prefetchLink.getAttribute("href") !== href) {
			prefetchLink.setAttribute("href", href);
		}
		return;
	}
	const link = document.createElement("link");
	link.rel = "prefetch";
	link.as = "fetch";
	link.href = href;
	prefetchLink = link;
	document.head.append(link);
}

/**
 * 预热抽屉：把 iframe 建好、在后台把评论页连壁纸一起加载。
 * 只认第一次 —— 鼠标扫过一排评论按钮时不能每次都重建；真点开时如果预热的是另一条
 * 动态，openCommentDrawer 只把 path 递过去，不会重载文档。
 */
function prewarmDrawer(trigger: HTMLElement): boolean {
	if (frame?.isConnected) return true;
	// 地址挂在整条动态上（[data-dynamic-entry]），按钮本身只有 data-dynamic-comment
	const src = trigger.closest<HTMLElement>("[data-comment-src]")?.dataset
		.commentSrc;
	if (!src) return false;
	const target = ensureFrame(src);
	if (!target) return false;
	target.title = trigger.getAttribute("aria-label") || "Comments";
	// 顺手把几何量了：iframe 先在默认宽度下把壁纸画好，点开时才被撑到右栏宽度就还得
	// 重排一次；提前量好，那一次重排就落在不可见的预热阶段
	const drawer = getDrawer();
	if (drawer) fitGeometry(drawer);
	return true;
}

/** navigator.connection 的精简形状：lib.dom 里还是实验特性，各浏览器也不全 */
interface NetworkInformationLike {
	saveData?: boolean;
	effectiveType?: string;
}

let warmScheduled = false;

/**
 * 页面空闲时就把评论页建好、连文档带壁纸一起加载完。
 *
 * 悬浮预热只救得了「鼠标移过去再点」这一条路径：触屏、键盘回车、手快连点都是冷启动，
 * iframe 要现下载整个文档 —— 那几百毫秒里浏览器给 iframe 的垫底就是白屏。
 * 提前建好之后，点开只是把一列「壁纸已经画好」的界面滑进来，中间没有任何加载。
 *
 * 代价是闲时多下一次评论页 + 几 MB 壁纸 JSON，所以省流模式和 2G 下不做。
 */
export function scheduleDrawerWarm(): void {
	if (typeof window === "undefined" || warmScheduled) return;
	// 已经建好了（悬浮预热过、或者上一页留下的）：不用再排
	if (frame?.isConnected) return;

	const connection = (
		navigator as unknown as { connection?: NetworkInformationLike }
	).connection;
	if (connection?.saveData) return;
	if (/^(slow-)?2g$/.test(connection?.effectiveType ?? "")) return;

	warmScheduled = true;
	const run = () => {
		warmScheduled = false;
		if (frame?.isConnected) return;
		// 页面上没有评论入口（没开动态评论 / 空列表）就不用白建一层。
		// 取第一条真正带地址的：没接评论服务的那几条只有按钮、没有 data-comment-src
		const trigger = Array.from(
			document.querySelectorAll<HTMLElement>("[data-dynamic-comment]"),
		).find((button) => button.closest("[data-comment-src]"));
		if (trigger) prewarmDrawer(trigger);
	};

	const idle = (
		window as unknown as {
			requestIdleCallback?: (
				callback: () => void,
				options?: { timeout: number },
			) => number;
		}
	).requestIdleCallback;
	// timeout 是兜底：页面上一直有动画在跑时，idle 可能迟迟不触发
	if (idle) idle(run, { timeout: 2500 });
	else window.setTimeout(run, 1200);
}

function onIntent(event: Event): void {
	const target = event.target as Element | null;
	const trigger = target?.closest<HTMLElement>("[data-dynamic-comment]");
	if (!trigger) return;
	// 预热 iframe 会顺带把壁纸 JSON 取下来（评论页自己去 fetch）；
	// 只有预热不了（拿不到地址）时才退回到单独的 prefetch 提示
	if (!prewarmDrawer(trigger)) prefetchWallpaper();
}

/** 设置面板换了壁纸：同步给 iframe，顺手把 preload 预热换成新那张 */
function onWallpaperChange(): void {
	// 外壳的垫底色也跟着换：下次冷启动露的应该是新壁纸的色调
	const drawer = getDrawer();
	if (drawer) paintDrawerTint(drawer);
	syncFrameWallpaper();
	if (prefetchLink) prefetchWallpaper();
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
	window.addEventListener("commentWallpaperChange", onWallpaperChange);
	window.addEventListener("resize", onResize, { passive: true });
	window.addEventListener("message", onFrameMessage);
	// 切页时抽屉 DOM 会被 Swup 换掉，顺手把状态清干净
	document.addEventListener("swup:visit:start", () =>
		closeCommentDrawer(false),
	);

	// 空闲预热：让「点开即成品」不只对鼠标用户成立
	scheduleDrawerWarm();
}
