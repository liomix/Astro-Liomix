/**
 * 主题：明暗模式、色相、定时切换、系统偏好监听
 *
 * 由 setting-utils.ts 按职责拆出；对外仍经 setting-utils.ts 暴露，调用点不变。
 */

import {
	runThemeReveal,
	type ThemeTransitionOrigin,
} from "@/features/theme/lib/light-dark-switch";
import {
	DARK_MODE,
	DEFAULT_THEME,
	LIGHT_MODE,
	SCHEDULED_MODE,
	SYSTEM_MODE,
} from "@/shared/config/constants";
import { expressiveCodeConfig } from "@/shared/config/expressiveCodeConfig";
import { siteConfig } from "@/shared/config/siteConfig";
import type { LightDarkMode } from "@/shared/types/siteConfig";

// Declare global functions
declare global {
	interface Window {
		initSemifullScrollDetection?: () => void;
		semifullScrollHandler?: () => void;
	}
}

export function getDefaultHue(): number {
	const fallback = "250";
	// 检查是否在浏览器环境中
	if (typeof document === "undefined") {
		return Number.parseInt(fallback, 10);
	}
	const configCarrier = document.getElementById("config-carrier");
	return Number.parseInt(configCarrier?.dataset.hue || fallback, 10);
}

export function getDefaultTheme(): LightDarkMode {
	// 如果配置文件中设置了 defaultMode，使用配置的值
	// 否则使用 DEFAULT_THEME（向后兼容）
	return siteConfig.themeColor.defaultMode ?? DEFAULT_THEME;
}

// 获取系统主题
export function getSystemTheme(): LightDarkMode {
	if (typeof window === "undefined") {
		return LIGHT_MODE;
	}
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? DARK_MODE
		: LIGHT_MODE;
}

/**
 * 主题定时切换配置。
 * dayStart 起（含）至 nightStart 前为日间；nightStart 起至次日 dayStart 前为夜间。
 * 允许跨零点，例如 dayStart 18:00 / nightStart 07:00 表示「18:00 开始日间」。
 */
export interface ThemeSchedule {
	dayStart: string;
	nightStart: string;
}

const THEME_SCHEDULE_KEY = "themeSchedule";

export const DEFAULT_THEME_SCHEDULE: ThemeSchedule = {
	dayStart: "07:00",
	nightStart: "18:00",
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeTime(value: unknown, fallback: string): string {
	return typeof value === "string" && TIME_PATTERN.test(value)
		? value
		: fallback;
}

function toMinutes(value: string): number {
	const [hours, minutes] = value.split(":");
	return Number(hours) * 60 + Number(minutes);
}

export function getThemeSchedule(): ThemeSchedule {
	if (typeof localStorage === "undefined") {
		return { ...DEFAULT_THEME_SCHEDULE };
	}
	try {
		const raw = localStorage.getItem(THEME_SCHEDULE_KEY);
		if (!raw) return { ...DEFAULT_THEME_SCHEDULE };
		const parsed = JSON.parse(raw) as Partial<ThemeSchedule>;
		return {
			dayStart: normalizeTime(parsed.dayStart, DEFAULT_THEME_SCHEDULE.dayStart),
			nightStart: normalizeTime(
				parsed.nightStart,
				DEFAULT_THEME_SCHEDULE.nightStart,
			),
		};
	} catch {
		return { ...DEFAULT_THEME_SCHEDULE };
	}
}

export function setThemeSchedule(dayStart: string, nightStart: string): void {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.setItem !== "function"
	) {
		return;
	}
	const schedule: ThemeSchedule = {
		dayStart: normalizeTime(dayStart, DEFAULT_THEME_SCHEDULE.dayStart),
		nightStart: normalizeTime(nightStart, DEFAULT_THEME_SCHEDULE.nightStart),
	};
	localStorage.setItem(THEME_SCHEDULE_KEY, JSON.stringify(schedule));
	// 定时模式下改时间段要立刻重算一次，否则要等下一个 tick
	if (getStoredTheme() === SCHEDULED_MODE) {
		applyThemeToDocument(SCHEDULED_MODE);
		setupScheduledThemeListener();
		// 通知导航栏图标等外部监听者刷新显示
		window.dispatchEvent(new CustomEvent("theme-change"));
	}
}

/** 当前时刻是否处于日间时段（支持跨零点的时间段） */
export function isDayTime(
	schedule: ThemeSchedule = getThemeSchedule(),
	now: Date = new Date(),
): boolean {
	const minutes = now.getHours() * 60 + now.getMinutes();
	const dayStart = toMinutes(schedule.dayStart);
	const nightStart = toMinutes(schedule.nightStart);
	// 起止时间相同视为全天日间，避免出现「永不天亮」
	if (dayStart === nightStart) return true;
	if (dayStart < nightStart) {
		return minutes >= dayStart && minutes < nightStart;
	}
	return minutes >= dayStart || minutes < nightStart;
}

// 解析主题（system 取系统主题，scheduled 按时间段取日间/夜间）
export function resolveTheme(theme: LightDarkMode): LightDarkMode {
	if (theme === SYSTEM_MODE) {
		return getSystemTheme();
	}
	if (theme === SCHEDULED_MODE) {
		return isDayTime() ? LIGHT_MODE : DARK_MODE;
	}
	return theme;
}

export function getHue(): number {
	// 先检查全局对象
	if (typeof window === "undefined" || !window.localStorage) {
		return getDefaultHue();
	}
	const stored = localStorage.getItem("hue");
	return stored ? Number.parseInt(stored, 10) : getDefaultHue();
}

export function setHue(hue: number): void {
	// 先检查是否在浏览器环境
	if (
		typeof window === "undefined" ||
		!window.localStorage ||
		typeof document === "undefined"
	) {
		return;
	}
	localStorage.setItem("hue", String(hue));
	const r = document.querySelector(":root") as HTMLElement;
	if (!r) {
		return;
	}
	r.style.setProperty("--hue", String(hue));
}

export function applyThemeToDocument(theme: LightDarkMode): void {
	// 检查是否在浏览器环境中
	if (typeof document === "undefined") {
		return;
	}

	// 解析主题
	const resolvedTheme = resolveTheme(theme);

	// 获取当前主题状态的完整信息
	const currentIsDark = document.documentElement.classList.contains("dark");
	const currentTheme = document.documentElement.getAttribute("data-theme");

	// 计算目标主题状态
	let targetIsDark = false; // 初始化默认值
	switch (resolvedTheme) {
		case LIGHT_MODE:
			targetIsDark = false;
			break;
		case DARK_MODE:
			targetIsDark = true;
			break;
		default:
			// 处理默认情况，使用当前主题状态
			targetIsDark = currentIsDark;
			break;
	}

	// 检测是否真的需要主题切换：
	// 1. dark类状态是否改变
	// 2. expressiveCode主题是否需要更新
	const needsThemeChange = currentIsDark !== targetIsDark;
	const expectedTheme = targetIsDark
		? expressiveCodeConfig.darkTheme
		: expressiveCodeConfig.lightTheme;
	const needsCodeThemeUpdate = currentTheme !== expectedTheme;

	// 如果既不需要主题切换也不需要代码主题更新，直接返回
	if (!needsThemeChange && !needsCodeThemeUpdate) {
		return;
	}

	// 批量 DOM 操作，减少重绘
	if (needsThemeChange) {
		// 添加过渡保护类（但会导致大量重绘，所以使用更轻量的方式）
		// document.documentElement.classList.add("is-theme-transitioning");

		// 直接切换主题，利用 CSS 变量的特性让浏览器优化过渡
		if (targetIsDark) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	}

	// Set the theme for Expressive Code based on current mode
	if (needsCodeThemeUpdate) {
		document.documentElement.setAttribute("data-theme", expectedTheme);
	}
}

// 系统主题监听器引用
let systemThemeListener:
	| ((e: MediaQueryListEvent | MediaQueryList) => void)
	| null = null;

export function setTheme(
	theme: LightDarkMode,
	origin?: ThemeTransitionOrigin,
): void {
	// 检查是否在浏览器环境中
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.setItem !== "function"
	) {
		return;
	}

	const apply = () => {
		// 先应用主题
		applyThemeToDocument(theme);

		// 保存到localStorage
		localStorage.setItem("theme", theme);

		// 如果切换到 system 模式，需要监听系统主题变化
		if (theme === SYSTEM_MODE) {
			setupSystemThemeListener();
		} else {
			// 如果切换其他模式，移除系统主题监听
			cleanupSystemThemeListener();
		}

		// 定时模式：启动/停止按时间段轮询
		if (theme === SCHEDULED_MODE) {
			setupScheduledThemeListener();
		} else {
			cleanupScheduledThemeListener();
		}

		// 通知其他组件主题已变更（导航栏图标、主题弹窗选中项、波浪效果等）
		if (typeof window !== "undefined") {
			window.dispatchEvent(new CustomEvent("theme-change"));
		}
	};

	// 没有点击位置（定时/跟随系统触发）或明暗实际没变时不做圆形揭示，
	// 省掉一次全屏快照，直接应用。
	const currentIsDark = document.documentElement.classList.contains("dark");
	const nextIsDark = resolveTheme(theme) === DARK_MODE;
	if (!origin || currentIsDark === nextIsDark) {
		apply();
		return;
	}

	runThemeReveal(apply, { origin, toDark: nextIsDark });
}

// 设置系统主题监听器
export function setupSystemThemeListener(): void {
	// 先清理之前的监听器
	cleanupSystemThemeListener();

	if (typeof window === "undefined") {
		return;
	}

	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

	// 处理系统主题变化的回调
	const handleSystemThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
		const isDark = e.matches;
		const currentIsDark = document.documentElement.classList.contains("dark");

		// 如果主题状态没有变化，直接返回
		if (currentIsDark === isDark) {
			return;
		}

		// 直接应用系统主题，不使用过渡保护类以避免大量重绘
		if (isDark) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}

		// Set the theme for Expressive Code
		const expressiveTheme = isDark
			? expressiveCodeConfig.darkTheme
			: expressiveCodeConfig.lightTheme;
		document.documentElement.setAttribute("data-theme", expressiveTheme);

		// 触发自定义事件通知其他组件（仅在真正切换时触发）
		window.dispatchEvent(new CustomEvent("theme-change"));
	};

	// 立即调用一次以设置初始状态
	handleSystemThemeChange(mediaQuery);

	// 监听系统主题变化（现代浏览器）
	if (mediaQuery.addEventListener) {
		mediaQuery.addEventListener("change", handleSystemThemeChange);
	} else {
		// 兼容旧浏览器
		mediaQuery.addListener(handleSystemThemeChange);
	}

	systemThemeListener = handleSystemThemeChange;
}

// 清理系统主题监听器
function cleanupSystemThemeListener() {
	if (typeof window === "undefined" || !systemThemeListener) {
		return;
	}

	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

	if (mediaQuery.removeEventListener) {
		mediaQuery.removeEventListener("change", systemThemeListener);
	} else {
		// 兼容旧浏览器
		mediaQuery.removeListener(systemThemeListener);
	}

	systemThemeListener = null;
}

// 定时切换的轮询计时器（30s 一次，跨过边界后最多半分钟内生效）
let scheduledThemeTimer: ReturnType<typeof setInterval> | null = null;

/** 定时模式下检查一次当前时段，主题不符就切换并广播 theme-change */
function applyScheduledThemeTick(): void {
	if (typeof document === "undefined") return;
	if (getStoredTheme() !== SCHEDULED_MODE) return;

	const targetIsDark = !isDayTime();
	const currentIsDark = document.documentElement.classList.contains("dark");
	if (targetIsDark === currentIsDark) return;

	document.documentElement.classList.toggle("dark", targetIsDark);
	document.documentElement.setAttribute(
		"data-theme",
		targetIsDark
			? expressiveCodeConfig.darkTheme
			: expressiveCodeConfig.lightTheme,
	);
	window.dispatchEvent(new CustomEvent("theme-change"));
}

function handleScheduledVisibilityChange(): void {
	// 后台标签页的定时器会被节流，回到前台时立刻校正一次
	if (document.visibilityState === "visible") applyScheduledThemeTick();
}

/** 启动定时切换：立即校正一次，之后每 30 秒检查一次 */
export function setupScheduledThemeListener(): void {
	cleanupScheduledThemeListener();

	if (typeof window === "undefined") {
		return;
	}

	applyScheduledThemeTick();
	scheduledThemeTimer = setInterval(applyScheduledThemeTick, 30_000);
	document.addEventListener(
		"visibilitychange",
		handleScheduledVisibilityChange,
	);
}

function cleanupScheduledThemeListener(): void {
	if (typeof window === "undefined") {
		return;
	}
	if (scheduledThemeTimer !== null) {
		clearInterval(scheduledThemeTimer);
		scheduledThemeTimer = null;
	}
	document.removeEventListener(
		"visibilitychange",
		handleScheduledVisibilityChange,
	);
}

export function getStoredTheme(): LightDarkMode {
	// 检查是否在浏览器环境中
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultTheme();
	}
	return (localStorage.getItem("theme") as LightDarkMode) || getDefaultTheme();
}

// 初始化主题监听器（用于页面加载后）
export function initThemeListener(): void {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return;
	}

	const theme = getStoredTheme();

	// 如果主题是 system 模式，需要监听系统主题变化
	if (theme === SYSTEM_MODE) {
		setupSystemThemeListener();
	}

	// 定时模式：页面加载后启动时段轮询
	if (theme === SCHEDULED_MODE) {
		setupScheduledThemeListener();
	}
}

// Card follow theme functions
export function getDefaultCardFollowThemeEnabled(): boolean {
	return siteConfig.card?.followTheme ?? false;
}

export function getStoredCardFollowThemeEnabled(): boolean {
	if (typeof localStorage === "undefined") {
		return getDefaultCardFollowThemeEnabled();
	}
	const stored = localStorage.getItem("cardFollowThemeEnabled");
	if (stored === null) {
		return getDefaultCardFollowThemeEnabled();
	}
	return stored === "true";
}

export function setCardFollowThemeEnabled(enabled: boolean): void {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.setItem !== "function"
	) {
		return;
	}
	localStorage.setItem("cardFollowThemeEnabled", String(enabled));
	if (enabled) {
		document.body.classList.add("card-follow-theme-hue");
	} else {
		document.body.classList.remove("card-follow-theme-hue");
	}
}
