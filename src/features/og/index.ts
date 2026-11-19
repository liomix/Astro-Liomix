/**
 * OG 图域：构建期把文章渲染成 1200×630 的分享卡片。
 * 端点（路由）在 pages/og/[...slug].ts，这里只导出渲染器与开关判定。
 */

// 渲染器
export { renderPostOgImage, shouldGenerateOgImages } from "./lib/render";
