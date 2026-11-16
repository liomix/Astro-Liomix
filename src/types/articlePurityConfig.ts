import type { WidgetComponentType } from "./sidebarConfig";

/**
 * 文章页纯净模式
 * ---------------------------------------------------------------------------
 * 文章详情页只留「文章目录」一张卡，其余侧栏卡片全部隐藏。目录本来在右栏，这里把
 * 右栏整体挪到左列 —— 于是正文左边是目录、右边空出来放竖版多标签导航栏。
 * 目的是读文章时不被无关卡片打断，同时标签栏仍在手边。
 */
export type ArticlePurityConfig = {
	/** 总开关 */
	enable: boolean;
	/** 纯净模式下保留的卡片（要有 sidebarToc，否则左列会空） */
	keepWidgets: WidgetComponentType[];
	/** 把多标签导航栏改成竖版、钉在右列 */
	sideTabBar: boolean;
};
