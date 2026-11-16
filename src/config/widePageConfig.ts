import type { WidePageConfig } from "../types/widePageConfig";

/**
 * 宽幅页面布局：命中 paths 的页面隐藏侧栏与多标签栏，正文占满整宽
 */
export const widePageConfig: WidePageConfig = {
	enable: true,

	// 留言板：便利贴墙需要横向铺开，侧栏会让每列都变得很窄
	paths: ["/guestbook/"],
};
