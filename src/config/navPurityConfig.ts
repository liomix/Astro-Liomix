import type { NavPurityConfig } from "../types/navPurityConfig";

/**
 * 导航页纯净模式：导航栏里的页面只留正文 + 个人资料卡，宽度保持不变
 */
export const navPurityConfig: NavPurityConfig = {
	// 是否启用。关闭后所有页面恢复成多标签栏 + 完整侧栏
	enable: true,

	// 纯净模式下唯一保留的卡片：个人资料
	// （想连资料卡也藏起来，把这个数组清空即可）
	keepWidgets: ["profile"],

	// 导航栏里没列、但也想走纯净模式的页面，例如 "/search/"
	extraPaths: [],

	// 导航栏里有链接、但不该走纯净模式的页面。
	// 留言板在「社交」下拉里，但它要的是自己的大页布局（见 widePageConfig）
	excludePaths: ["/guestbook/"],
};
