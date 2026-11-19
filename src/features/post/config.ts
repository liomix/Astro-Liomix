/**
 * 文章域配置（唯一事实来源）
 * ---------------------------------------------------------------------------
 * 许可证、封面、纯净模式、打赏讲的是同一件事：这篇文章页怎么显示。
 * 加一个开关只改这里，不再跨四个文件找。
 *
 * 用 `as const satisfies` 而不是 `: PostConfig`：保留字面量类型（enable: true 而不是
 * boolean），同时仍受类型约束 —— 否则 `if (config.x)` 永远为真。
 */
import type { PostConfig } from "./types";

export const postConfig = {
	/** 文章顶部许可证信息 */
	license: {
		// 是否启用文章顶部许可证信息显示
		enable: true,

		// 许可证名称及链接
		name: "CC BY-NC-SA 4.0",
		url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
	},

	/** 封面图（含随机封面 API） */
	cover: {
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
	},

	/** 文章页纯净模式：只留目录，标签栏竖排到右列 */
	purity: {
		// 是否启用。关闭后文章页恢复成左右侧栏完整布局
		enable: true,

		// 唯一保留的卡片：文章目录（它在 sidebarConfig 的 rightComponents 里）
		keepWidgets: ["sidebarToc"],

		// 多标签导航栏改竖版钉在右列（关掉则右列保持空白）
		sideTabBar: true,
	},

	/** 打赏入口（文章页底部的金币按钮 + 弹窗） */
	sponsor: {
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
	},
} as const satisfies PostConfig;
