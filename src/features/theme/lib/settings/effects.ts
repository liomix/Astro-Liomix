/**
 * 背景特效开关：波浪、渐变、樱花
 *
 * 由 setting-utils.ts 按职责拆出；对外仍经 setting-utils.ts 暴露，调用点不变。
 */

import { sakuraConfig } from "@/features/effects/config";
import { backgroundWallpaperConfig } from "@/shared/config/backgroundWallpaperConfig";

// Declare global functions
declare global {
	interface Window {
		initSemifullScrollDetection?: () => void;
		semifullScrollHandler?: () => void;
	}
}

// Waves animation functions
export function getDefaultWavesEnabled(): boolean {
	const wavesConfig = backgroundWallpaperConfig.common?.waves?.enable;
	if (typeof wavesConfig === "object") {
		// 如果是分设备配置，检查当前设备
		const isMobile =
			typeof window !== "undefined" ? window.innerWidth < 768 : false;
		return isMobile
			? (wavesConfig.mobile ?? false)
			: (wavesConfig.desktop ?? false);
	}
	return wavesConfig ?? false;
}

export function getStoredWavesEnabled(): boolean {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultWavesEnabled();
	}
	const stored = localStorage.getItem("wavesEnabled");
	if (stored === null) {
		return getDefaultWavesEnabled();
	}
	return stored === "true";
}

export function setWavesEnabled(enabled: boolean): void {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.setItem !== "function"
	) {
		return;
	}
	localStorage.setItem("wavesEnabled", String(enabled));
	applyWavesEnabledToDocument(enabled);
}

export function applyWavesEnabledToDocument(enabled: boolean): void {
	if (typeof document === "undefined") {
		return;
	}
	// 更新 html 属性，CSS 会立即生效
	document.documentElement.setAttribute("data-waves-enabled", String(enabled));
	// 同时更新元素样式（兼容性）
	const wavesElement = document.getElementById("header-waves");
	if (wavesElement) {
		if (enabled) {
			wavesElement.style.display = "";
			wavesElement.classList.remove("waves-disabled");
		} else {
			wavesElement.style.display = "none";
			wavesElement.classList.add("waves-disabled");
		}
	}
}

// Gradient transition functions
export function getDefaultGradientEnabled(): boolean {
	const gradientConfig = backgroundWallpaperConfig.common?.gradient?.enable;
	if (typeof gradientConfig === "object") {
		const isMobile =
			typeof window !== "undefined" ? window.innerWidth < 768 : false;
		return isMobile
			? (gradientConfig.mobile ?? true)
			: (gradientConfig.desktop ?? true);
	}
	return gradientConfig ?? true;
}

export function getStoredGradientEnabled(): boolean {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultGradientEnabled();
	}
	const stored = localStorage.getItem("gradientEnabled");
	if (stored === null) {
		return getDefaultGradientEnabled();
	}
	return stored === "true";
}

export function setGradientEnabled(enabled: boolean): void {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.setItem !== "function"
	) {
		return;
	}
	localStorage.setItem("gradientEnabled", String(enabled));
	applyGradientEnabledToDocument(enabled);
}

export function applyGradientEnabledToDocument(enabled: boolean): void {
	if (typeof document === "undefined") {
		return;
	}
	document.documentElement.setAttribute(
		"data-gradient-enabled",
		String(enabled),
	);
	const gradientElement = document.getElementById("wallpaper-gradient");
	if (gradientElement) {
		if (enabled) {
			gradientElement.style.display = "";
			gradientElement.classList.remove("gradient-disabled");
		} else {
			gradientElement.style.display = "none";
			gradientElement.classList.add("gradient-disabled");
		}
	}
}

// Sakura effect functions
export function getDefaultSakuraEnabled(): boolean {
	return sakuraConfig?.enable ?? false;
}

export function getStoredSakuraEnabled(): boolean {
	if (typeof localStorage === "undefined") {
		return getDefaultSakuraEnabled();
	}
	const stored = localStorage.getItem("sakuraEnabled");
	if (stored === null) {
		return getDefaultSakuraEnabled();
	}
	return stored === "true";
}

export function setSakuraEnabled(enabled: boolean): void {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.setItem !== "function"
	) {
		return;
	}
	localStorage.setItem("sakuraEnabled", String(enabled));
	document.documentElement.setAttribute("data-sakura-enabled", String(enabled));
	// 实时切换樱花特效
	window.dispatchEvent(
		new CustomEvent("sakuraToggle", { detail: { enabled } }),
	);
}
