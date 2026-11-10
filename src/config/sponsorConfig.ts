import type { SponsorConfig } from "../types/sponsorConfig";

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
