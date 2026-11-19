export type LicenseConfig = {
	enable: boolean;
	name: string;
	url: string;
};

export type CoverImageConfig = {
	enableInPost: boolean; // 是否在文章详情页显示封面图
	enableInPostOverlay?: boolean; // 是否使用标题和元数据叠加在封面上的布局
	showLoading?: boolean; // 是否显示加载动画
	randomCoverImage: {
		enable: boolean; // 是否启用随机图功能
		apis: string[]; // 随机图API列表
	};
};

import type { WidgetComponentType } from "@/shared/types/sidebarConfig";

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

// 打赏配置（文章页底部的打赏弹窗）
export type SponsorConfig = {
	usage?: string; // 打赏用途说明
	showButtonInPost?: boolean; // 是否在文章详情页底部显示打赏按钮，默认 true
	qrCode?: string; // 弹窗展示的收款码（相对 public 目录），留空则不显示打赏入口
	qrLabel?: string; // 收款码下方的收款方式名，如「微信」
};

/**
 * 沉浸阅读（Immersive Reading）配置（挂在 siteConfig.post 下）
 */
export interface ImmersiveReadingConfig {
	/** 总开关，false 则不渲染按钮 */
	enable: boolean;
	/** 进入文章页是否默认开启沉浸阅读（默认 false） */
	defaultOn: boolean;
	/** 沉浸阅读中是否显示目录栏 */
	tocEnabled: boolean;
	/** 目录栏位置："left" | "right" */
	tocPosition: "left" | "right";
}
