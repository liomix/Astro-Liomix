import type { LicenseConfig } from "@/features/post/types";

export const licenseConfig: LicenseConfig = {
	// 是否启用文章顶部许可证信息显示
	enable: true,

	// 许可证名称及链接
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

import type { CoverImageConfig } from "@/features/post/types";

/**
 * 文章封面图配置
 *
 * enableInPost - 是否在文章详情页显示封面图
 * enableInPostOverlay - 是否使用标题和元数据叠加在封面上的布局
 * showLoading - 是否显示封面图加载动画
 *
 * 随机封面图使用说明：
 * 1. 在文章的 Frontmatter 中添加 image: "api" 即可使用随机图功能
 * 2. 系统会依次尝试所有配置的 API，全部失败后保留 LQIP 并显示错误提示
 *
 * // 文章 Frontmatter 示例：
 * ---
 * title: 文章标题
 * image: "api"
 * ---
 */
export const coverImageConfig: CoverImageConfig = {
	// 是否在文章详情页显示封面图
	enableInPost: true,

	// 是否使用标题和元数据叠加在封面上的布局
	enableInPostOverlay: false,

	// 是否显示转圈圈加载动画，会替代掉LQIP
	showLoading: false,

	randomCoverImage: {
		// 随机封面图功能开关
		enable: false,
		// 封面图API列表
		apis: [
			"https://t.alcy.cc/pc",
			"https://www.dmoe.cc/random.php",
			"https://uapis.cn/api/v1/random/image?category=acg&type=pc",
		],
	},
};

import type { ArticlePurityConfig } from "@/features/post/types";

/**
 * 文章页纯净模式：只留目录，目录移到左列，右列给竖版标签栏
 */
export const articlePurityConfig: ArticlePurityConfig = {
	// 是否启用。关闭后文章页恢复成左右侧栏完整布局
	enable: true,

	// 唯一保留的卡片：文章目录（它在 sidebarConfig 的 rightComponents 里）
	keepWidgets: ["sidebarToc"],

	// 多标签导航栏改竖版钉在右列（关掉则右列保持空白）
	sideTabBar: true,
};

import type { SponsorConfig } from "@/features/post/types";

export const sponsorConfig: SponsorConfig = {
	// 打赏用途说明，显示在文章页打赏弹窗里
	usage:
		"您的打赏将用于服务器维护、内容创作和功能开发，帮助我持续提供优质内容。",

	// 是否在文章详情页底部显示打赏按钮
	showButtonInPost: true,

	// 打赏弹窗里的收款码（相对于 public 目录），点击文章底部的金币按钮弹出
	// 留空则不显示打赏入口
	qrCode: "/assets/images/sponsor/wechat-tip.png",

	// 收款码下方的收款方式名，如「微信」「支付宝」
	qrLabel: "微信",
};
