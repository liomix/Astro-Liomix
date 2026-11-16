import type { WidgetComponentType } from "./sidebarConfig";

/**
 * 导航页纯净模式
 * ---------------------------------------------------------------------------
 * 导航栏里列出的页面（归档、分类、动态、相册…）多是「列表型」页面：读者进来是
 * 为了找东西，多标签栏和满屏卡片只是噪音。打开这个开关后，这些页面会：
 *   1. 隐藏多标签导航栏；
 *   2. 侧栏只保留 keepWidgets 里的卡片（默认只有个人资料）；
 *   3. 列宽照旧按 sidebarLayoutConfig 计算 —— 卡片只是 display:none，列的
 *      位置仍然占着，正文宽度不变，切进切出不会让页面跳一下。
 *
 * 「哪些页面算导航页」由 navBarConfig 自动推导（导航栏里的站内链接），
 * 不必在这里再抄一份路径；自动推导之外的用 extraPaths 追加。
 */
export type NavPurityConfig = {
	/** 总开关 */
	enable: boolean;
	/** 纯净模式下依然保留的侧栏卡片类型 */
	keepWidgets: WidgetComponentType[];
	/** 自动推导之外、也要走纯净模式的页面路径 */
	extraPaths: string[];
	/**
	 * 从自动推导结果里剔除的页面路径（前缀命中）。
	 * 用于「页面在导航栏里有链接，但不该被纯净模式接管」的情况 ——
	 * 例如留言板需要自己的大页布局。
	 */
	excludePaths: string[];
};
