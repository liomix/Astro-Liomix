/**
 * 主题域：深浅色、显示设置面板与其持久化。
 */

// 组件
export { default as DisplaySettings } from "./components/DisplaySettings.svelte";
export { default as LightDarkSwitch } from "./components/LightDarkSwitch.svelte";
export { default as SettingsButton } from "./components/SettingsButton.astro";
export { default as SettingsMenu } from "./components/SettingsMenu.astro";

// 配置
export { displaySettingsConfig } from "./config";
// 工具 / 契约
export { resolveDisplaySettingsConfig } from "./lib/display-settings";
export type { ThemeTransitionOrigin } from "./lib/light-dark-switch";
export { originFromElement, runThemeReveal } from "./lib/light-dark-switch";
export {
	applyBannerCarouselEnabledToDocument,
	applyBannerTitleEnabledToDocument,
	getDefaultBannerCarouselEnabled,
	getDefaultBannerTitleEnabled,
	getDefaultCardBorderEnabled,
	getStoredBannerCarouselEnabled,
	getStoredBannerTitleEnabled,
	getStoredCardBorderEnabled,
	setBannerCarouselEnabled,
	setBannerTitleEnabled,
	setCardBorderEnabled,
} from "./lib/settings/appearance";
export {
	getDefaultCommentWallpaper,
	getStoredCommentWallpaper,
	setCommentWallpaper,
} from "./lib/settings/comment-wallpaper";
export {
	applyGradientEnabledToDocument,
	applyWavesEnabledToDocument,
	getDefaultGradientEnabled,
	getDefaultSakuraEnabled,
	getDefaultWavesEnabled,
	getStoredGradientEnabled,
	getStoredSakuraEnabled,
	getStoredWavesEnabled,
	setGradientEnabled,
	setSakuraEnabled,
	setWavesEnabled,
} from "./lib/settings/effects";
export {
	applyOverlayCardOpacityToDocument,
	applyOverlayOpacityToDocument,
	applyOverlayPanelTransparencyToDocument,
	applyOverlayTransparencyToDocument,
	applyStoredOverlaySettingsToDocument,
	getDefaultOverlayCardOpacity,
	getDefaultOverlayOpacity,
	getDefaultOverlayPanelTransparency,
	getDefaultOverlayTransparency,
	getStoredOverlayCardOpacity,
	getStoredOverlayOpacity,
	getStoredOverlayPanelTransparency,
	getStoredOverlayTransparency,
	overlayTransparencyToBlur,
	setOverlayCardOpacity,
	setOverlayOpacity,
	setOverlayPanelTransparency,
	setOverlayTransparency,
} from "./lib/settings/overlay";
export type { ThemeSchedule } from "./lib/settings/theme";
export {
	applyThemeToDocument,
	DEFAULT_THEME_SCHEDULE,
	getDefaultCardFollowThemeEnabled,
	getDefaultHue,
	getDefaultTheme,
	getHue,
	getStoredCardFollowThemeEnabled,
	getStoredTheme,
	getSystemTheme,
	getThemeSchedule,
	initThemeListener,
	isDayTime,
	resolveTheme,
	setCardFollowThemeEnabled,
	setHue,
	setTheme,
	setThemeSchedule,
	setupScheduledThemeListener,
	setupSystemThemeListener,
} from "./lib/settings/theme";
export {
	applyFullscreenLayoutToDocument,
	applyWallpaperModeToDocument,
	getDefaultFullscreenLayout,
	getStoredFullscreenLayout,
	getStoredWallpaperMode,
	initWallpaperMode,
	setFullscreenLayout,
	setWallpaperMode,
	syncBannerHomeTextVisibility,
	updateNavbarTransparency,
} from "./lib/settings/wallpaper";
export type { SettingsPanelId } from "./lib/settings-panels";
export {
	closeSettingsPanels,
	initSettingsPanels,
	openSettingsPanel,
	SETTINGS_PANEL_IDS,
	SETTINGS_TRIGGER_ID,
	toggleSettingsMenu,
} from "./lib/settings-panels";
// 类型
export type { DisplaySettingsConfig, OverlaySwitchable } from "./types";
