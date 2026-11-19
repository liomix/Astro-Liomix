import { initIconLoader } from "@/shared/lib/icon-loader";
import {
	initFullscreenWallpaper,
	syncFullscreenStateAfterInit,
} from "@/shared/lib/media/fullscreen-wallpaper";
import { initImageLoadFadeIn } from "@/shared/lib/media/lqip";
import { initTouchCodeCopyReveal } from "@/shared/lib/touch-copy";
import {
	registerContentOverflowListeners,
	scheduleContentOverflowEnhancements,
} from "./content-overflow";
import {
	initializeFloatingPanels,
	setClickOutsideToClose,
} from "./floating-panel";
import {
	moveSideTabBar,
	refreshSidebarStickyState,
	updateMainGridCols,
	updateSidebarComponentsVisibility,
} from "./grid-layout";
import { initScroll } from "./scroll";
import { setupSwupTransitions } from "./swup-transitions";

/** 由 Layout 注入的外观初始化（shared 不许 import 业务域） */
export interface LayoutInitHooks {
	/** 首屏与 DOMContentLoaded 后初始化主题 / 壁纸模式 */
	initAppearance?: () => void;
	/** 每次 swup 换页后同步外观状态 */
	onPageView?: () => void;
}

/** 布局初始化编排（从 Layout.astro 迁出） */
export function initLayout(hooks: LayoutInitHooks = {}): void {
	// 防止 Swup 切页重跑模块化脚本时重复注册监听器/钩子（一次性注册；
	// 切页后的页面状态刷新由下方 swup 钩子与一次性注册的 document 监听器负责）
	if (window.__fireflyLayoutInit) return;
	window.__fireflyLayoutInit = true;

	initializeFloatingPanels();

	// 设置面板组（设置菜单 / 主题设置 / 播放设置）的点击外部关闭由
	// utils/settings-panels.ts 统一处理，这里不再单独注册
	// nav-menu-panel 现为全屏抽屉（inset-0），点击外部永不触发且由遮罩点击关闭，
	// 不再注册 click-outside（见 NavMenuPanel.astro 的 document 委托）。
	setClickOutsideToClose("search-panel", ["search-panel", "search-switch"]);
	setClickOutsideToClose("wallpaper-mode-panel", [
		"wallpaper-mode-panel",
		"wallpaper-mode-switch",
	]);

	setupSwupTransitions({ onPageView: hooks.onPageView });
	initFullscreenWallpaper();
	registerContentOverflowListeners();
	// 滚动路径不再读取布局；先在初始化时填充侧边栏 top 容器可见性缓存
	refreshSidebarStickyState();
	initScroll();
	initTouchCodeCopyReveal();

	// 页面加载完成后初始化banner和内容溢出容器
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => {
			scheduleContentOverflowEnhancements();
		});
	} else {
		scheduleContentOverflowEnhancements();
	}

	// 竖版标签栏只在 xl 生效：首屏也要搬一次（applyPurityModes 只挂在切页钩子上），
	// 窗口跨过 1280 时也要搬回/搬进右栏，否则窄屏下它留在 display:none 的右栏里看不见
	const syncSideTabBar = () => {
		const host = document.getElementById("content-panel-inner");
		moveSideTabBar(
			host?.dataset.articlePurity === "true" && window.innerWidth >= 1280,
		);
	};

	// Initialize wallpaper mode
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => {
			updateMainGridCols();
			updateSidebarComponentsVisibility();
			syncSideTabBar();
			hooks.initAppearance?.();
			initIconLoader();
			syncFullscreenStateAfterInit();
		});
	} else {
		updateMainGridCols();
		updateSidebarComponentsVisibility();
		syncSideTabBar();
		hooks.initAppearance?.();
		initIconLoader();
		syncFullscreenStateAfterInit();
	}

	initImageLoadFadeIn();
	let sideTabBarFrame = 0;
	window.addEventListener("resize", () => {
		if (sideTabBarFrame) return;
		sideTabBarFrame = requestAnimationFrame(() => {
			sideTabBarFrame = 0;
			syncSideTabBar();
		});
	});
	// 切页换入后延到下一帧再重扫 LQIP fade-in，避免 astro:page-load 在同帧叠加
	// 一堆游标/事件重扫阻塞换入首帧（swup:contentReplaced 已 rAF，一并延后）
	document.addEventListener("astro:page-load", () => {
		requestAnimationFrame(initImageLoadFadeIn);
	});
	document.addEventListener("swup:contentReplaced", () => {
		requestAnimationFrame(initImageLoadFadeIn);
	});
}
