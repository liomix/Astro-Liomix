export type ProfileStatus = {
	/** 总开关：false 时不渲染徽章（等同于删掉 status），默认 true */
	enable?: boolean;
	/** 状态文字：收起时隐藏，悬浮/聚焦后向右展开；留空则只显示图标、不展开 */
	text?: string;
	/** 状态图标（Iconify 名称，见 https://icones.js.org/）；留空退化为一个圆点 */
	icon?: string;
	/** 图标 / 圆点颜色，留空用主题色 */
	color?: string;
};

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
	/** 头像右下角的状态徽章：收起只显示图标，悬浮展开为「图标 + 文字」 */
	status?: ProfileStatus;
	name: string;
	bio?: string;
	links: {
		name: string;
		url: string;
		icon: string;
		showName?: boolean;
	}[];
};
