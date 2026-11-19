/**
 * 浮层与卡片透明度：透明度 ↔ 模糊换算、存储与落到 document
 *
 * 由 setting-utils.ts 按职责拆出；对外仍经 setting-utils.ts 暴露，调用点不变。
 */
import { backgroundWallpaperConfig } from "@/shared/config/backgroundWallpaperConfig";

// Declare global functions
declare global {
	interface Window {
		initSemifullScrollDetection?: () => void;
		semifullScrollHandler?: () => void;
	}
}

// Overlay settings functions
function clampNumber(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** 背景透明度的模糊上限：透明度 0%（完全遮住）对应 20px 模糊 */
const OVERLAY_MAX_BLUR = 20;

/** 背景透明度（0-1）→ CSS blur 像素：100% 透明 = 0px（清晰），0% = 20px（最模糊） */
export function overlayTransparencyToBlur(transparency: number): number {
	return (1 - clampNumber(transparency, 0, 1)) * OVERLAY_MAX_BLUR;
}

export function getDefaultOverlayOpacity(): number {
	return backgroundWallpaperConfig.overlay?.opacity ?? 0.8;
}

export function getDefaultOverlayTransparency(): number {
	return clampNumber(
		backgroundWallpaperConfig.overlay?.transparency ?? 0.5,
		0,
		1,
	);
}

export function getDefaultOverlayCardOpacity(): number {
	return backgroundWallpaperConfig.overlay?.cardOpacity ?? 0.6;
}

/** 弹窗（浮动面板）透明度：1 = 完全透明，0 = 完全不透明。
 *  配置里的旧字段 panelOpacity 存的是 alpha（不透明度），换算成 1 - alpha 以保持原有观感 */
export function getDefaultOverlayPanelTransparency(): number {
	const legacyOpacity = backgroundWallpaperConfig.overlay?.panelOpacity;
	if (typeof legacyOpacity === "number") {
		return clampNumber(1 - legacyOpacity, 0, 1);
	}
	return clampNumber(
		backgroundWallpaperConfig.overlay?.panelTransparency ??
			1 - getDefaultOverlayCardOpacity(),
		0,
		1,
	);
}

export function getStoredOverlayOpacity(): number {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultOverlayOpacity();
	}
	const stored = localStorage.getItem("overlayOpacity");
	if (stored === null) {
		return getDefaultOverlayOpacity();
	}
	const parsed = Number.parseFloat(stored);
	if (Number.isNaN(parsed)) {
		return getDefaultOverlayOpacity();
	}
	return clampNumber(parsed, 0, 1);
}

export function getStoredOverlayTransparency(): number {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultOverlayTransparency();
	}
	const stored = localStorage.getItem("overlayTransparency");
	if (stored !== null) {
		const parsed = Number.parseFloat(stored);
		if (!Number.isNaN(parsed)) {
			return clampNumber(parsed, 0, 1);
		}
	}
	// 旧版本存的是模糊像素（overlayBlur），换算成透明度，避免用户此前的设置丢失
	const legacyBlur = localStorage.getItem("overlayBlur");
	if (legacyBlur !== null) {
		const parsed = Number.parseFloat(legacyBlur);
		if (!Number.isNaN(parsed)) {
			return clampNumber(1 - parsed / OVERLAY_MAX_BLUR, 0, 1);
		}
	}
	return getDefaultOverlayTransparency();
}

export function getStoredOverlayCardOpacity(): number {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultOverlayCardOpacity();
	}
	const stored = localStorage.getItem("overlayCardOpacity");
	if (stored === null) {
		return getDefaultOverlayCardOpacity();
	}
	const parsed = Number.parseFloat(stored);
	if (Number.isNaN(parsed)) {
		return getDefaultOverlayCardOpacity();
	}
	return clampNumber(parsed, 0, 1);
}

export function getStoredOverlayPanelTransparency(): number {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultOverlayPanelTransparency();
	}
	const stored = localStorage.getItem("overlayPanelTransparency");
	if (stored !== null) {
		const parsed = Number.parseFloat(stored);
		if (!Number.isNaN(parsed)) {
			return clampNumber(parsed, 0, 1);
		}
	}
	// 旧版本存的是不透明度（overlayPanelOpacity），换算成透明度，避免用户此前的设置丢失
	const legacyOpacity = localStorage.getItem("overlayPanelOpacity");
	if (legacyOpacity !== null) {
		const parsed = Number.parseFloat(legacyOpacity);
		if (!Number.isNaN(parsed)) {
			return clampNumber(1 - parsed, 0, 1);
		}
	}
	return getDefaultOverlayPanelTransparency();
}

export function applyOverlayOpacityToDocument(opacity: number): void {
	if (typeof document === "undefined") {
		return;
	}
	const safeOpacity = clampNumber(opacity, 0, 1);
	const wallpaperWrapper = document.getElementById("wallpaper-wrapper");
	if (wallpaperWrapper) {
		wallpaperWrapper.style.setProperty(
			"--overlay-opacity",
			String(safeOpacity),
		);
	}
}

export function applyOverlayTransparencyToDocument(transparency: number): void {
	if (typeof document === "undefined") {
		return;
	}
	const safeTransparency = clampNumber(transparency, 0, 1);
	const wallpaperWrapper = document.getElementById("wallpaper-wrapper");
	if (wallpaperWrapper) {
		wallpaperWrapper.style.setProperty(
			"--overlay-blur",
			`${overlayTransparencyToBlur(safeTransparency)}px`,
		);
	}
}

export function applyOverlayCardOpacityToDocument(cardOpacity: number): void {
	if (typeof document === "undefined") {
		return;
	}
	const safeCardOpacity = clampNumber(cardOpacity, 0, 1);
	document.documentElement.style.setProperty(
		"--card-transparent-opacity",
		String(safeCardOpacity),
	);
}

export function applyOverlayPanelTransparencyToDocument(
	transparency: number,
): void {
	if (typeof document === "undefined") {
		return;
	}
	const safeTransparency = clampNumber(transparency, 0, 1);
	// CSS 侧的 --panel-transparent-opacity 仍然是不透明度（alpha），这里做一次换算：
	// 透明度 100% → alpha 0（全透），0% → alpha 1（全实）
	document.documentElement.style.setProperty(
		"--panel-transparent-opacity",
		String(1 - safeTransparency),
	);
	// 毛玻璃强度同步跟随：100% 透明时把 backdrop blur 收到 0，否则弹窗始终是一层
	// 奶白磨砂，滑块看起来像没生效（背景色变了但观感几乎不变）
	document.documentElement.style.setProperty(
		"--panel-blur-factor",
		String(1 - safeTransparency),
	);
}

export function setOverlayOpacity(opacity: number): void {
	const safeOpacity = clampNumber(opacity, 0, 1);
	if (
		typeof localStorage !== "undefined" &&
		typeof localStorage.setItem === "function"
	) {
		localStorage.setItem("overlayOpacity", String(safeOpacity));
	}
	applyOverlayOpacityToDocument(safeOpacity);
}

export function setOverlayTransparency(transparency: number): void {
	const safeTransparency = clampNumber(transparency, 0, 1);
	if (
		typeof localStorage !== "undefined" &&
		typeof localStorage.setItem === "function"
	) {
		localStorage.setItem("overlayTransparency", String(safeTransparency));
	}
	applyOverlayTransparencyToDocument(safeTransparency);
}

export function setOverlayCardOpacity(cardOpacity: number): void {
	const safeCardOpacity = clampNumber(cardOpacity, 0, 1);
	if (
		typeof localStorage !== "undefined" &&
		typeof localStorage.setItem === "function"
	) {
		localStorage.setItem("overlayCardOpacity", String(safeCardOpacity));
	}
	applyOverlayCardOpacityToDocument(safeCardOpacity);
}

export function setOverlayPanelTransparency(transparency: number): void {
	const safeTransparency = clampNumber(transparency, 0, 1);
	if (
		typeof localStorage !== "undefined" &&
		typeof localStorage.setItem === "function"
	) {
		localStorage.setItem("overlayPanelTransparency", String(safeTransparency));
	}
	applyOverlayPanelTransparencyToDocument(safeTransparency);
}

export function applyStoredOverlaySettingsToDocument(): void {
	applyOverlayOpacityToDocument(getStoredOverlayOpacity());
	applyOverlayTransparencyToDocument(getStoredOverlayTransparency());
	applyOverlayCardOpacityToDocument(getStoredOverlayCardOpacity());
	applyOverlayPanelTransparencyToDocument(getStoredOverlayPanelTransparency());
}
