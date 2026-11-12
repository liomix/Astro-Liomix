/** 评论区壁纸（动态页评论抽屉里铺满聊天区的那张 Lottie 动画） */

export interface CommentWallpaperItem {
	/** 稳定标识，会写进 localStorage；改掉等于丢掉已有访客的选择 */
	id: string;
	/** 设置面板里显示的名字 */
	name: string;
	/** Lottie JSON 地址，相对站点根目录（放在 public 下，不要写 BASE_URL） */
	src: string;
	/**
	 * 色板。第一个是主色，兼作「壁纸画出来之前的垫底色」——挑最接近成品整体明度的那个，
	 * 太深会让打开抽屉时先暗一下；其余只用于设置面板上的缩略色块。
	 */
	colors: string[];
}

export interface CommentWallpaperConfig {
	/** 是否允许在「设置 → 壁纸」里切换；关掉后固定使用默认那张 */
	switchable: boolean;
	/** 默认壁纸 id，也是「恢复默认」的目标 */
	defaultId: string;
	/** 可选项，至少一张 */
	wallpapers: CommentWallpaperItem[];
}
