/**
 * 主网格列布局与侧边栏可见性 / 吸顶间距管理（从 Layout.astro 迁出）。
 */

import { articlePurityConfig } from "@/config/articlePurityConfig";
import { widePageConfig } from "@/config/widePageConfig";
import { matchesPathScope } from "@/utils/nav-purity-utils";
import {
	computeGridColumns,
	gridColumnVarsToStyle,
} from "@/utils/responsive-utils";
import { isArticleDetailPage } from "@/utils/url-utils";

const sidebarStickyState: Record<
	"left" | "right",
	{ topClass: "top-0" | "top-4"; hasVisibleTop: boolean }
> = {
	left: { topClass: "top-0", hasVisibleTop: false },
	right: { topClass: "top-0", hasVisibleTop: false },
};

// 检查当前页面是否为文章/项目详情页
const isCurrentPagePost = (): boolean =>
	isArticleDetailPage(window.location.pathname);

// 上一次写入 #main-grid 的几何，用于 page:view 重复调用时短路
let lastAppliedGeometry = "";

// 更新主网格的列几何。
// SSR 写的是同一组自定义属性（见 MainGridLayout 的 style），这里在每次 swup page:view 时
// 按当前页面类型重算，保证软导航后与 SSR 一致；两者共用 computeGridColumns 这一真源。
export function updateMainGridCols(): void {
	const mainGrid = document.getElementById("main-grid");
	// 几何自定义属性写在 #content-panel-inner 上（#main-grid 的父级）：
	// 页脚是 #main-grid 的兄弟，只有挂到共同祖先才能继承同一组 --content-ratio-*
	const varHost = document.getElementById("content-panel-inner");
	if (!mainGrid || !varHost) return;

	const isPostPage = isCurrentPagePost();
	// 缺省视为 true（fail-open）：属性缺失时不要误把整列折叠掉
	const flag = (name: string): boolean =>
		mainGrid.getAttribute(name) !== "false";
	const positionAttr = mainGrid.getAttribute("data-sidebar-position");
	// 无侧栏列时内容栏占包裹层总宽的比例（0–1）；空串/缺失表示未配置（铺满）
	const capRaw = mainGrid.getAttribute("data-no-sidebar-content-width");
	const capNum = capRaw ? Number(capRaw) : Number.NaN;

	const vars = computeGridColumns({
		enabled: flag("data-sidebar-enable"),
		position:
			positionAttr === "right" || positionAttr === "both"
				? positionAttr
				: "left",
		tabletSidebar:
			mainGrid.getAttribute("data-tablet-sidebar") === "right"
				? "right"
				: "left",
		hideSidebarOnPostPage:
			mainGrid.getAttribute("data-grid-hide-sidebar-on-post") === "true",
		isPostPage,
		hasLeftWidgets: flag(
			isPostPage ? "data-has-left-on-post" : "data-has-left-on-non-post",
		),
		hasRightWidgets: flag(
			isPostPage ? "data-has-right-on-post" : "data-has-right-on-non-post",
		),
		noSidebarContentWidth: Number.isFinite(capNum) ? capNum : undefined,
	});

	const serialized = gridColumnVarsToStyle(vars);
	if (serialized === lastAppliedGeometry) return;
	lastAppliedGeometry = serialized;
	for (const [key, value] of Object.entries(vars)) {
		varHost.style.setProperty(key, value);
	}
}

/** 读 #main-grid 上 SSR 写的纯净模式范围；未启用或没配到页面时返回 null */
function readNavPurityPaths(): string[] | null {
	const mainGrid = document.getElementById("main-grid");
	if (!mainGrid || mainGrid.getAttribute("data-nav-purity-enable") !== "true") {
		return null;
	}
	return readPathList(mainGrid, "data-nav-purity-paths");
}

/** 读 #main-grid 上 SSR 写的宽幅页面范围；未启用时返回 null */
function readWidePagePaths(): string[] | null {
	const mainGrid = document.getElementById("main-grid");
	if (!mainGrid || mainGrid.getAttribute("data-wide-page-enable") !== "true") {
		return null;
	}
	return readPathList(mainGrid, "data-wide-page-paths");
}

/** 逗号分隔的路径表 → 数组（空串过滤掉，否则 join 出来的空项会变成一个空路径） */
function readPathList(host: HTMLElement, attr: string): string[] {
	return (host.getAttribute(attr) ?? "")
		.split(",")
		.map((path) => path.trim())
		.filter(Boolean);
}

/** 写开关。两个状态都放在 #content-panel-inner 上：侧栏、多标签栏都是它的后代 */
function setPurityAttr(host: HTMLElement, name: string, active: boolean): void {
	const next = active ? "true" : "false";
	if (host.getAttribute(name) !== next) {
		host.setAttribute(name, next);
	}
}

/**
 * 按目标地址切换两种纯净模式（状态唯一来源就是 URL）。
 *
 * 调用点有两处：content:replace（旧内容已淡出、新内容还没出现，此刻切看不见）
 * 和 page:view（兜底，防止某个钩子没跑到）。
 * 不读新 DOM 上的属性 —— swup 替换容器的时序不可靠，属性一旦没带过来就会退回
 * 「卡片又显示出来」。
 */
export function applyPurityModes(targetUrl: string): void {
	const host = document.getElementById("content-panel-inner");
	if (!host) return;

	let pathname: string;
	try {
		pathname = new URL(targetUrl, window.location.href).pathname;
	} catch {
		return;
	}

	// 导航页：隐藏多标签栏与除 keepWidgets 外的卡片
	const navPaths = readNavPurityPaths();
	if (navPaths) {
		setPurityAttr(
			host,
			"data-nav-purity",
			matchesPathScope(pathname, navPaths),
		);
	}

	// 宽幅页面：隐藏侧栏与多标签栏，列几何收成单列（正文真正变宽）
	const widePaths = readWidePagePaths();
	if (widePaths && widePageConfig.enable) {
		setPurityAttr(
			host,
			"data-wide-page",
			matchesPathScope(pathname, widePaths),
		);
	}

	// 文章页：只留目录（目录卡已配在左栏），标签栏竖排搬进右列
	if (articlePurityConfig.enable) {
		const articlePurity = isArticleDetailPage(pathname);
		setPurityAttr(host, "data-article-purity", articlePurity);
		// 竖版只在 xl 生效：更窄的断点右栏不显示，搬进去会看不见，所以留原位横版
		moveSideTabBar(articlePurity && window.innerWidth >= 1280);
	}
}

// 更新侧边栏组件的可见性
export function updateSidebarComponentsVisibility(): void {
	const isPostPage = isCurrentPagePost();

	// 处理侧边栏级别的 hideSidebarOnPostPage 配置
	document
		.querySelectorAll<HTMLElement>("[data-hide-sidebar-on-post]")
		.forEach((wrapper) => {
			const hideOnPost =
				wrapper.getAttribute("data-hide-sidebar-on-post") === "true";
			if (isPostPage && hideOnPost) {
				wrapper.style.setProperty("display", "none", "important");
			} else {
				wrapper.style.removeProperty("display");
			}
		});

	// 处理组件级别的 showOnPostPage 配置
	document.querySelectorAll(".widget-hide-on-post").forEach((widget) => {
		isPostPage
			? widget.classList.add("hidden")
			: widget.classList.remove("hidden");
	});

	// 处理 hideOnNonPostPage === true 的组件
	document.querySelectorAll(".widget-hide-on-non-post").forEach((widget) => {
		!isPostPage
			? widget.classList.add("hidden")
			: widget.classList.remove("hidden");
	});

	// 组件可见性变化后，重新读取 top 容器可见性并重算 sticky 间距，避免 swup 切页后残留旧间距
	refreshSidebarStickyState();
}

// 重新读取侧边栏 top 容器的可见性并应用间距。
// 含 offsetHeight 布局读取，仅初始化 / 切页时调用；滚动路径使用缓存值，避免每帧强制布局
export function refreshSidebarStickyState(): void {
	(["left", "right"] as const).forEach((side) => {
		const sticky = document.getElementById(`${side}-sidebar-sticky`);
		if (!sticky) return;

		// 结构为：sidebar -> top 容器（可选） + sticky 容器
		const topContainer = sticky.previousElementSibling as HTMLElement | null;
		const hasVisibleTop = !!topContainer && topContainer.offsetHeight > 1;
		sidebarStickyState[side].hasVisibleTop = hasVisibleTop;

		// swup 从非文章页切换到文章页时，top 容器可能残留 mb-4，需要按可见性动态修正
		if (topContainer) {
			if (hasVisibleTop) {
				topContainer.classList.add("mb-4");
			} else {
				topContainer.classList.remove("mb-4");
			}
		}
	});

	updateSidebarStickySpacing();
}

// 根据当前滚动位置动态更新侧边栏 sticky 顶部偏移。
// 滚动路径：仅切换滚动相关的 top-0/top-4，不再读取布局（hasVisibleTop 由 refreshSidebarStickyState 缓存）
export function updateSidebarStickySpacing(): void {
	const scrollTop = document.documentElement.scrollTop || window.scrollY || 0;
	const isScrolled = scrollTop > 2;

	(["left", "right"] as const).forEach((side) => {
		const sticky = document.getElementById(`${side}-sidebar-sticky`);
		if (!sticky) return;

		// 仅切换顶部偏移；组件间距由容器常驻 gap-4 保持
		const nextTopClass: "top-0" | "top-4" =
			sidebarStickyState[side].hasVisibleTop || isScrolled ? "top-4" : "top-0";

		if (sidebarStickyState[side].topClass !== nextTopClass) {
			sticky.classList.remove(sidebarStickyState[side].topClass);
			sticky.classList.add(nextTopClass);
			sidebarStickyState[side].topClass = nextTopClass;
		}
	});
}

/**
 * 文章页纯净模式：把多标签栏搬进右栏，当成一张 sticky 卡片。
 *
 * 它原本在 #content-column 内部（正文上方），成不了外层 grid item，所以之前只能用
 * fixed 悬浮 —— 但 fixed 不会像 sticky 那样「到父容器底部就停」，和左栏的目录卡
 * 观感对不上。直接把节点搬进 #right-sidebar（纯净模式下那一列是空的）就解决了：
 * sticky 相对这一列生效，滚动行为与目录卡完全一致，不用任何滚动补偿。
 *
 * 只搬一次（父节点相同就跳过）。搬回时插到 #content-column 最前面，恢复原位。
 */
export function moveSideTabBar(side: boolean): void {
	const wrapper = document.getElementById("tab-bar-wrapper");
	const column = document.getElementById("content-column");
	const rightSidebar = document.getElementById("right-sidebar");
	if (!wrapper || !column || !rightSidebar) return;

	if (side) {
		if (wrapper.parentElement !== rightSidebar) {
			wrapper.classList.add("article-side-tabbar");
			rightSidebar.append(wrapper);
		}
		return;
	}

	if (wrapper.parentElement !== column) {
		wrapper.classList.remove("article-side-tabbar");
		column.prepend(wrapper);
	}
}
