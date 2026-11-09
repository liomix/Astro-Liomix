export type ProfileConfig = {
	avatar?: string;
	/** 头像形状：rect 圆角矩形（默认），circle 正圆 */
	avatarShape?: "rect" | "circle";
	/**
	 * 头像动态策略，只决定「怎么识别头像」，不是播放开关：
	 * - "auto"（默认）：按文件自动识别，读文件头（gif/apng/动态 webp/avif）+ 扩展名（mp4/webm/mov/m4v）
	 * - "always"：始终当动态资源，绕过图片优化直出原文件（远程动态 WebP/AVIF 读不到文件头时用）
	 * - "never"：始终当静态图，只取第一帧并走图片优化
	 */
	avatarMotion?: "auto" | "always" | "never";
	/** 视频头像的封面图：首帧显示用，也给 OG 图这类只吃静态图的地方用 */
	avatarPoster?: string;
	/** 是否在卡片底部显示「文章 / 标签 / 分类」三列统计，默认 true */
	showStats?: boolean;
	name: string;
	bio?: string;
	links: {
		name: string;
		url: string;
		icon: string;
		showName?: boolean;
	}[];
};
