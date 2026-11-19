/**
 * 壁纸模式与全屏布局：模式解析、导航栏透明、横幅文字可见性
 *
 * 由 setting-utils.ts 按职责拆出；对外仍经 setting-utils.ts 暴露，调用点不变。
 */

import { backgroundWallpaperConfig } from "@/shared/config/backgroundWallpaperConfig";
import {
	WALLPAPER_BANNER,
	WALLPAPER_FULLSCREEN,
	WALLPAPER_NONE,
	WALLPAPER_OVERLAY,
} from "@/shared/config/constants";
import { displaySettingsConfig } from "@/shared/config/displaySettings";
import { isHomePage as checkIsHomePage } from "@/shared/lib/layout/layout-utils";
import type { FullscreenWallpaperLayout } from "@/shared/types/backgroundWallpaperConfig";
import type { WallpaperMode } from "@/shared/types/siteConfig";
import { applyStoredOverlaySettingsToDocument } from "./overlay";

// Declare global functions
declare global {
	interface Window {
		initSemifullScrollDetection?: () => void;
		semifullScrollHandler?: () => void;
	}
}

// Wallpaper mode functions

/**
 * 同步首页标题显示（hidden 类）：首页 + banner/fullscreen 模式显示标题，其余情况隐藏。
 * SSR 按 config 默认模式渲染 hidden（默认 overlay/none 时带 hidden），而模式可运行时切换、
 * 页面也会经 Swup 切换（body.is-home 变化），因此需要按当前 mode + 是否首页重新计算。
 * 标题开关（user-hidden 类）独立控制，不受影响。
 */
export function syncBannerHomeTextVisibility(): void {
	const overlay = document.querySelector(
		".banner-home-text-overlay",
	) as HTMLElement | null;
	if (!overlay) return;
	const mode = document.documentElement.getAttribute("data-wallpaper-mode");
	const isHome = checkIsHomePage(window.location.pathname);
	const show =
		isHome && (mode === WALLPAPER_BANNER || mode === WALLPAPER_FULLSCREEN);
	overlay.classList.toggle("hidden", !show);
}

export function getDefaultFullscreenLayout(): FullscreenWallpaperLayout {
	return backgroundWallpaperConfig.fullscreen?.layout ?? "classic";
}

export function getStoredFullscreenLayout(): FullscreenWallpaperLayout {
	const defaultLayout = getDefaultFullscreenLayout();
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return defaultLayout;
	}
	const isSwitchable = displaySettingsConfig.fullscreenLayoutSwitchable;
	if (!isSwitchable) {
		localStorage.removeItem("fullscreenLayout");
		return defaultLayout;
	}
	const stored = localStorage.getItem("fullscreenLayout");
	return stored === "hero" || stored === "classic" ? stored : defaultLayout;
}

export function applyFullscreenLayoutToDocument(
	layout: FullscreenWallpaperLayout,
	animate = true,
): void {
	if (typeof document === "undefined") return;

	const safeLayout: FullscreenWallpaperLayout =
		layout === "hero" ? "hero" : "classic";
	const html = document.documentElement;
	if (animate) {
		html.classList.add("is-fullscreen-layout-transitioning");
		window.setTimeout(() => {
			html.classList.remove("is-fullscreen-layout-transitioning");
		}, 520);
	}
	html.setAttribute("data-fullscreen-layout", safeLayout);

	const mode = html.getAttribute("data-wallpaper-mode");
	const transparent =
		mode === WALLPAPER_OVERLAY ||
		(mode === WALLPAPER_FULLSCREEN && safeLayout === "hero");
	document.body?.classList.toggle("wallpaper-transparent", transparent);
	window.dispatchEvent(
		new CustomEvent("fullscreenLayoutChange", {
			detail: { layout: safeLayout },
		}),
	);
}

export function setFullscreenLayout(layout: FullscreenWallpaperLayout): void {
	const safeLayout: FullscreenWallpaperLayout =
		layout === "hero" ? "hero" : "classic";
	if (
		typeof localStorage !== "undefined" &&
		typeof localStorage.setItem === "function"
	) {
		localStorage.setItem("fullscreenLayout", safeLayout);
	}
	applyFullscreenLayoutToDocument(safeLayout);
}

export function applyWallpaperModeToDocument(
	mode: WallpaperMode,
	animate = true,
): void {
	const html = document.documentElement;
	const isHeroFullscreen =
		html.getAttribute("data-fullscreen-layout") === "hero";

	// 先启用过渡类再设置模式：确保 --content-top 变化时 top 过渡已激活（否则位置瞬间到位不动画）
	if (animate) {
		html.classList.add("is-wallpaper-transitioning");
		window.setTimeout(
			() => html.classList.remove("is-wallpaper-transitioning"),
			520,
		);
	}

	html.setAttribute("data-wallpaper-mode", mode);

	// 首页标题显示：按当前模式 + 是否首页同步 hidden 类（SSR 按 config 默认模式渲染 hidden，
	// 模式运行时切换后需同步）。
	syncBannerHomeTextVisibility();

	// 卡片透明类：唯一运行时写入者（解析期由 body 起始脚本写入）
	const transparent =
		mode === WALLPAPER_OVERLAY ||
		(mode === WALLPAPER_FULLSCREEN && isHeroFullscreen);
	document.body.classList.toggle("wallpaper-transparent", transparent);

	updateNavbarTransparency(mode);
	window.dispatchEvent(
		new CustomEvent("wallpaperModeChange", { detail: { mode } }),
	);
}

export function updateNavbarTransparency(mode: WallpaperMode): void {
	const navbar = document.getElementById("navbar");
	if (!navbar) return;

	let transparentMode: string;
	let blurAmount: number;

	// 根据当前壁纸模式设置导航栏透明模式和模糊效果
	if (mode === WALLPAPER_OVERLAY) {
		// 全屏透明模式
		transparentMode = "none";
		blurAmount = 0;
	} else if (mode === WALLPAPER_NONE) {
		// 纯色背景模式
		transparentMode = "none";
		blurAmount = 0;
	} else if (mode === WALLPAPER_FULLSCREEN) {
		// 全屏壁纸：首页 + semifull 动态透明，其余半透明玻璃
		const isHomePage = checkIsHomePage(window.location.pathname);
		const fsMode =
			backgroundWallpaperConfig.fullscreen?.navbar?.transparentMode ||
			"semifull";
		const glassBlur = backgroundWallpaperConfig.fullscreen?.navbar?.blur ?? 20;
		transparentMode = fsMode === "semifull" && isHomePage ? "semifull" : "semi";
		blurAmount = glassBlur;
	} else {
		// Banner模式：不再按首页/非首页降级成 semi —— 桌面端非首页也有 45vh 横幅，
		// 导航栏要一直悬在壁纸上；移动端非首页没有横幅，由 navbar.css 的 [data-is-home] 条件回落到卡底色
		transparentMode =
			backgroundWallpaperConfig.banner?.navbar?.transparentMode || "semi";
		blurAmount = backgroundWallpaperConfig.banner?.navbar?.blur ?? 20;
	}

	// 更新导航栏的透明模式属性
	navbar.setAttribute("data-transparent-mode", transparentMode);
	navbar.style.setProperty("--navbar-glass-blur", `${blurAmount}px`);

	// 移除现有的透明模式类
	navbar.classList.remove(
		"navbar-transparent-semi",
		"navbar-transparent-full",
		"navbar-transparent-semifull",
	);

	// 移除scrolled类
	navbar.classList.remove("scrolled");

	// 滚动检测功能
	if (
		transparentMode === "semifull" &&
		(mode === WALLPAPER_BANNER || mode === WALLPAPER_FULLSCREEN) &&
		typeof window.initSemifullScrollDetection === "function"
	) {
		// 在Banner和全屏壁纸模式的semifull下启用滚动检测
		window.initSemifullScrollDetection();
	} else if (window.semifullScrollHandler) {
		// 移除滚动监听器
		window.removeEventListener("scroll", window.semifullScrollHandler);
		delete window.semifullScrollHandler;
	}
}

export function setWallpaperMode(mode: WallpaperMode): void {
	// 检查是否在浏览器环境中
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.setItem !== "function"
	) {
		return;
	}
	localStorage.setItem("wallpaperMode", mode);
	applyWallpaperModeToDocument(mode);
}

export function initWallpaperMode(): void {
	// 初始化透明模式参数（透明度 / 背景透明度 / 卡片透明度 / 弹窗透明度）
	applyStoredOverlaySettingsToDocument();
	const storedMode = getStoredWallpaperMode();
	applyWallpaperModeToDocument(storedMode, false);
}

export function getStoredWallpaperMode(): WallpaperMode {
	// 检查是否在浏览器环境中
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return backgroundWallpaperConfig.mode;
	}

	const isSwitchable = displaySettingsConfig.wallpaperModeSwitchable;
	if (!isSwitchable) {
		localStorage.removeItem("wallpaperMode");
		return backgroundWallpaperConfig.mode;
	}

	return (
		(localStorage.getItem("wallpaperMode") as WallpaperMode) ||
		backgroundWallpaperConfig.mode
	);
}
