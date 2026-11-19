/**
 * 「回首页」入口的统一行为。
 *
 * 站内有两种回首页：
 *   1. 导航栏左上角的站名/logo —— 保持默认，落到首页顶部（hero 大图）；
 *   2. 其余入口（分类栏的房子图标、右下角悬浮的主页按钮、404 的返回首页）——
 *      标记 `data-home-entry`，落在「内容区」（资料卡 / 分类栏 / 文章列表）。
 *
 * 已经在首页时不再触发一次 Swup 跳转（那会把内容重置回顶部），只做一次定位；
 * 从别的页面回来时用 sessionStorage 记一个待定位标记，落地后再滚到内容区。
 */

const PENDING_KEY = "firefly-home-return";

/** 落地后校正几次：Swup 切页会先把滚动复位到 0，内容区是 absolute 定位，需要等一帧才量得到 */
const SETTLE_DELAYS = [0, 120, 380];

type SwupLike = { navigate?: (url: string) => void };

function getBasePath(): string {
	return (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
}

/** 站点根（含 base） */
export function homeUrl(): string {
	return `${getBasePath()}/`;
}

function normalizePath(path: string): string {
	const trimmed = path.replace(/\/+$/, "");
	return trimmed === "" ? "/" : trimmed;
}

export function isHomePage(): boolean {
	return normalizePath(window.location.pathname) === normalizePath(homeUrl());
}

/** 内容区在文档中的落点：让内容面板顶边贴在导航栏下方 */
function homeContentOffset(): number | null {
	// 量 #content-panel 而不是 #main-grid：内容块带 onload-animation 的
	// fade-in-up（translateY），刚切页时量到的 top 会比稳定值低一截。
	const content =
		document.getElementById("content-panel") ??
		document.getElementById("main-grid") ??
		document.getElementById("content-column");
	if (!content) return null;

	const navbar = document.getElementById("navbar");
	const navbarHeight = navbar ? navbar.getBoundingClientRect().height : 72;

	return Math.max(
		0,
		content.getBoundingClientRect().top + window.scrollY - navbarHeight - 8,
	);
}

/** 把视口定位到首页内容区；已在附近时直接跳过 */
export function scrollToHomeContent(behavior: ScrollBehavior = "smooth"): void {
	const target = homeContentOffset();
	if (target === null) return;
	if (Math.abs(window.scrollY - target) < 4) return;
	window.scrollTo({ top: target, behavior });
}

/** 所有「回首页」入口的共用动作 */
export function goHomeFromEntry(): void {
	if (isHomePage()) {
		// 已经在首页：不导航，只保证落在内容区
		scrollToHomeContent();
		return;
	}

	try {
		sessionStorage.setItem(PENDING_KEY, "1");
	} catch {
		// 隐私模式下 sessionStorage 可能不可写，退化成「回到顶部」即可
	}

	const swup = (window as Window & { swup?: SwupLike }).swup;
	if (swup?.navigate) {
		swup.navigate(homeUrl());
	} else {
		window.location.assign(homeUrl());
	}
}

function consumePendingReturn(): void {
	if (!isHomePage()) return;

	let pending = false;
	try {
		pending = sessionStorage.getItem(PENDING_KEY) === "1";
	} catch {
		return;
	}
	if (!pending) return;

	try {
		sessionStorage.removeItem(PENDING_KEY);
	} catch {
		// 忽略：清理失败最多让下一次进首页多滚动一次
	}

	for (const delay of SETTLE_DELAYS) {
		window.setTimeout(() => scrollToHomeContent("auto"), delay);
	}
}

let initialized = false;

/** 绑定 `data-home-entry` 的点击代理与落地校正（幂等） */
export function initHomeEntryLinks(): void {
	if (initialized || typeof window === "undefined") return;
	initialized = true;

	// 捕获阶段先于 Swup 的 document 监听，preventDefault 之后 Swup 会跳过这次访问
	document.addEventListener(
		"click",
		(event) => {
			if (event.defaultPrevented || event.button !== 0) return;
			// 组合键点击沿用浏览器原生行为（新标签页 / 新窗口 / 下载）
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
				return;

			const target = event.target;
			if (!(target instanceof Element)) return;

			const entry = target.closest("[data-home-entry]");
			if (!entry) return;
			if (
				entry instanceof HTMLAnchorElement &&
				entry.target &&
				entry.target !== "_self"
			)
				return;

			event.preventDefault();
			goHomeFromEntry();
		},
		true,
	);

	window.addEventListener("load", consumePendingReturn);
	document.addEventListener("astro:page-load", consumePendingReturn);
	document.addEventListener("swup:contentReplaced", consumePendingReturn);
}
