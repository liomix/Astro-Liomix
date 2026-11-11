/**
 * 评论抽屉（CommentDrawer）
 * ---------------------------------------------------------------------------
 * 点动态卡片底部的评论按钮，从屏幕右侧抽出一列抽屉：上下左右正好盖住右侧栏
 * 那两张卡片（几何由 fitGeometry 实测），内容仍是
 * `/dynamic/comments/` 这个独立页面，用 iframe 装 —— 评论服务（waline /
 * twikoo / giscus…）自成一套 DOM 与样式，塞进主文档会互相污染。
 *
 * 为什么由 JS 创建、挂到 <body> 上：
 *   1. 动态页条目是 SSR 静态 HTML + 模板克隆，每条渲染一个抽屉＝几十个隐藏
 *      iframe，只有点开的那条才需要；
 *   2. #content-wrapper 入场动画带 transform，transform 祖先会让 position:fixed
 *      相对祖先定位而不是视口，挂 body 才稳。
 */

const BOUND_KEY = "__fireflyCommentDrawerBound";

/** 关闭按钮的无障碍文案，由 Astro 侧按站点语言传入（客户端不引 i18n 语言包） */
let closeLabel = "Close";
/**
 * 顶栏头像下方那行联系方式。
 * Telegram 在这个位置显示「online」，本站放站长邮箱 —— 固定值、和界面语言无关，
 * 所以不进 i18n；要换地址改这一行即可。
 */
const CHAT_HANDLE = "liomix2077@qq.com";
/** 聊天对象的名字（顶栏标题），默认取触发按钮的 aria-label */
let chatName = "";
/** 聊天对象的头像图，空则退回首字母彩圆 */
let avatarUrl = "";

let activeTrigger: HTMLElement | null = null;
let frame: HTMLIFrameElement | null = null;
let themeObserver: MutationObserver | null = null;

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

/**
 * 顶栏头像：有站点头像图就用图（视频头像取封面帧），
 * 没有就退回首字母彩圆 —— 这正是 Telegram 无头像账号的画法
 */
function syncAvatar(drawer: HTMLElement, name: string): void {
	const avatar = drawer.querySelector<HTMLElement>(
		"[data-comment-drawer-avatar]",
	);
	if (!avatar) return;

	if (avatarUrl) {
		if (avatar.dataset.avatarSrc === avatarUrl) return;
		avatar.dataset.avatarSrc = avatarUrl;
		avatar.classList.add("has-image");
		const image = document.createElement("img");
		image.src = avatarUrl;
		image.alt = "";
		image.decoding = "async";
		avatar.replaceChildren(image);
		return;
	}

	delete avatar.dataset.avatarSrc;
	avatar.classList.remove("has-image");
	avatar.textContent = (name.trim().slice(0, 1) || "?").toUpperCase();
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
	drawer.innerHTML = `
		<header class="comment-drawer-head">
			<span class="comment-drawer-avatar" data-comment-drawer-avatar aria-hidden="true"></span>
			<span class="comment-drawer-heading">
				<span class="comment-drawer-title" data-comment-drawer-title></span>
				<span class="comment-drawer-status" data-comment-drawer-status></span>
			</span>
			<button type="button" class="comment-drawer-close" data-comment-drawer-close>
				<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
					<path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
				</svg>
			</button>
		</header>
		<div class="comment-drawer-body" data-comment-drawer-body></div>
	`;

	const close = drawer.querySelector<HTMLButtonElement>(
		"[data-comment-drawer-close]",
	);
	close?.setAttribute("aria-label", closeLabel);
	close?.addEventListener("click", () => closeCommentDrawer());
	const status = drawer.querySelector<HTMLElement>(
		"[data-comment-drawer-status]",
	);
	if (status) status.textContent = CHAT_HANDLE;

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
	// 顶栏标题优先用站点昵称（相当于聊天对象的名字），没传才退回按钮文案
	const title = chatName || label;
	const titleEl = drawer.querySelector<HTMLElement>(
		"[data-comment-drawer-title]",
	);
	if (titleEl && title) titleEl.textContent = title;
	syncAvatar(drawer, title);

	fitGeometry(drawer);
	const wasOpen = drawer.dataset.open === "true";
	activeTrigger?.classList.remove("is-active");
	activeTrigger?.setAttribute("aria-expanded", "false");
	activeTrigger = trigger;
	trigger.classList.add("is-active");
	trigger.setAttribute("aria-expanded", "true");

	drawer.removeAttribute("inert");
	drawer.setAttribute("aria-hidden", "false");
	// 从收起变展开时把焦点交给关闭按钮：visibility:hidden 的元素聚不了焦，
	// 所以必须等 data-open 生效之后；在两条动态之间切换则不抢焦点，避免打断阅读
	const focusClose = () => {
		if (wasOpen) return;
		drawer
			.querySelector<HTMLElement>("[data-comment-drawer-close]")
			?.focus({ preventScroll: true });
	};
	if (existing) {
		drawer.dataset.open = "true";
		focusClose();
		return;
	}
	// 刚插进 DOM 的元素与 data-open 同帧写入不会触发过渡，推到下一帧
	requestAnimationFrame(() => {
		if (activeTrigger !== trigger) return;
		drawer.dataset.open = "true";
		focusClose();
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

export function bindCommentDrawer(
	options: {
		closeLabel?: string;
		name?: string;
		avatarUrl?: string;
	} = {},
): void {
	if (typeof window === "undefined") return;
	if (options.closeLabel) closeLabel = options.closeLabel;
	if (options.name) chatName = options.name;
	if (options.avatarUrl) avatarUrl = options.avatarUrl;

	// 抽屉已经建好（同一页里换了一篇文章）时，把顶栏标题 / 头像刷新一遍
	const drawer = getDrawer();
	if (drawer) syncAvatar(drawer, chatName);

	const scope = window as unknown as Record<string, boolean | undefined>;
	if (scope[BOUND_KEY]) return;
	scope[BOUND_KEY] = true;

	observeTheme();
	document.addEventListener("click", onOutsideClick);
	document.addEventListener("keydown", onKeydown);
	window.addEventListener("resize", onResize, { passive: true });
	// 切页时抽屉 DOM 会被 Swup 换掉，顺手把状态清干净
	document.addEventListener("swup:visit:start", () =>
		closeCommentDrawer(false),
	);
}
