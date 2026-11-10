// 打赏配置（文章页底部的打赏弹窗）
export type SponsorConfig = {
	usage?: string; // 打赏用途说明
	showButtonInPost?: boolean; // 是否在文章详情页底部显示打赏按钮，默认 true
	qrCode?: string; // 弹窗展示的收款码（相对 public 目录），留空则不显示打赏入口
	qrLabel?: string; // 收款码下方的收款方式名，如「微信」
};
