/**
 * 特效域：樱花、波浪、打字机、Live2D、Spine 与背景视频。
 * 所有动画都必须响应 prefers-reduced-motion。
 */

// 组件
export { default as BackgroundPlayer } from "./components/BackgroundPlayer.astro";
export { default as Live2DWidget } from "./components/Live2DWidget.astro";
export { default as PioMessageBox } from "./components/PioMessageBox.astro";
export { default as SakuraEffect } from "./components/SakuraEffect.astro";
export { default as SpineModel } from "./components/SpineModel.astro";
export { default as TypewriterText } from "./components/TypewriterText.astro";
export { default as WavesEffect } from "./components/WavesEffect.astro";

// 配置
export { live2dWidgetConfig, sakuraConfig, spineModelConfig } from "./config";
export type { WavesLayer } from "./lib/waves-draw";

// 工具 / 契约
export {
	cubicBezier,
	EASE,
	ease,
	TRANSLATE_FROM,
	TRANSLATE_TO,
	VIEWBOX,
	WAVE_LAYERS,
	WAVE_PATH_D,
	WAVE_PATH_X_MAX,
	WAVE_PATH_X_MIN,
	WAVE_STRIP_W,
	WAVE_X_MAX,
	WAVE_X_MIN,
	WavesRenderer,
} from "./lib/waves-draw";
// 类型
export type {
	Live2DWidgetConfig,
	SakuraConfig,
	SakuraManagerLike,
	SakuraWorkerInboundMessage,
	SakuraWorkerOutboundMessage,
	SpineModelConfig,
	WavesManagerLike,
} from "./types";
