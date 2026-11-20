/**
 * 特效域：樱花、波浪、打字机与背景视频。
 *
 * 所有动画都必须响应 prefers-reduced-motion —— 两条 canvas 动画各自读 matchMedia，
 * 系统开了「减少动态效果」就整块不启动。
 *
 * 出口只放域外真正消费的东西：设置面板要 sakuraConfig，global.d.ts 要两个管理器契约。
 * waves-draw 的几何常量、worker 消息类型都是域内实现细节，透出去只会让外面误以为可用。
 */

// 组件
export { default as BackgroundPlayer } from "./components/BackgroundPlayer.astro";
export { default as SakuraEffect } from "./components/SakuraEffect.astro";
export { default as TypewriterText } from "./components/TypewriterText.astro";
export { default as WavesEffect } from "./components/WavesEffect.astro";

// 配置
export { sakuraConfig } from "./config";

// 类型
export type { SakuraManagerLike, WavesManagerLike } from "./types";
