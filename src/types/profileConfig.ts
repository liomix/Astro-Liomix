export type ProfileConfig = {
	avatar?: string;
	/** 头像形状：rect 圆角矩形（默认），circle 正圆 */
	avatarShape?: "rect" | "circle";
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
