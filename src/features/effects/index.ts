/**
 * 特效域：樱花、波浪、打字机与背景视频。
 * 所有动画都必须响应 prefers-reduced-motion。
 */

// 组件
export { default as BackgroundPlayer } from "./components/BackgroundPlayer.astro";
export { default as SakuraEffect } from "./components/SakuraEffect.astro";
export { default as TypewriterText } from "./components/TypewriterText.astro";
export { default as WavesEffect } from "./components/WavesEffect.astro";

// 配置
export { sakuraConfig } from "./config";
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
	SakuraConfig,
	SakuraManagerLike,
	SakuraWorkerInboundMessage,
	SakuraWorkerOutboundMessage,
	WavesManagerLike,
} from "./types";
