import type {
	CommentWallpaperConfig,
	CommentWallpaperItem,
} from "../types/commentWallpaperConfig";

/**
 * 评论区壁纸
 * ---------------------------------------------------------------------------
 * 动态页点评论抽出来的那个抽屉，聊天区铺的是一张 Lottie 动画（不是静态图）。
 * 这里登记可选的那几张，设置面板「壁纸 → 评论区壁纸」按这个列表渲染；
 * 访客选中的 id 存在 localStorage（键见 COMMENT_WALLPAPER_STORAGE_KEY）。
 *
 * 加一张新壁纸的步骤：
 *   1. 把 Lottie JSON 放进 public/lottie/；
 *   2. 在下面 wallpapers 里追加一条（id 别复用，name 显示在面板上；
 *      colors 取素材里两三个色值，**第一个**会当作「壁纸还没画出来时的垫底色」，
 *      所以要挑最接近成品整体明度的那个 —— 太深的话打开抽屉会先暗一下；
 *      其余几个只用于面板上的缩略色块）；
 *   3. 完事，不用改任何组件。
 *
 * 素材要求：1024×1024、所有图层同起同止（ip=0 / op=末帧）的一次性生长动画。
 * 播放逻辑见 components/pages/dynamic/comment-wallpaper.ts —— 它只播一遍再停末帧，
 * 循环素材会闪。
 */
export const commentWallpaperConfig: CommentWallpaperConfig = {
	switchable: true,
	defaultId: "1",
	wallpapers: [
		{
			id: "1",
			name: "苔绿",
			src: "/lottie/comment-wallpaper-1.json",
			colors: ["#c0d588", "#aac474", "#88b98a"],
		},
		{
			id: "2",
			name: "雾紫",
			src: "/lottie/comment-wallpaper-2.json",
			colors: ["#b8dde3", "#bca6d5", "#e9bcdf"],
		},
		{
			id: "3",
			name: "青蓝",
			src: "/lottie/comment-wallpaper-3.json",
			colors: ["#9bceba", "#8fc3cc", "#7bb0d6"],
		},
	],
};

/** 访客选择的存储键：设置面板写入、评论页读取，两边共用同一个常量 */
export const COMMENT_WALLPAPER_STORAGE_KEY = "commentWallpaper";

/**
 * 按 id 取壁纸，取不到就回退默认那张（再取不到就第一张）。
 * 传 null / undefined 表示「默认」。
 */
export function getCommentWallpaper(
	id?: string | null,
): CommentWallpaperItem {
	const { wallpapers, defaultId } = commentWallpaperConfig;
	return (
		wallpapers.find((item) => item.id === id) ??
		wallpapers.find((item) => item.id === defaultId) ??
		wallpapers[0]
	);
}
