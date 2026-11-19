import type { CommentApiConfig } from "@/shared/types/comments";

export const commentApiConfig: CommentApiConfig = {
	// 是否启用自建评论接口（动态页评论区）
	enable: true,
	// 自建评论后端地址（末尾不要带斜杠）。本地开发指向 Go 服务，部署后改成公网地址
	apiBaseUrl: "http://localhost:8080",
	// 一次拉多少条评论
	pageSize: 50,
	// 请求超时（毫秒）。超时或后端不可用时聊天气泡区显示空态
	requestTimeoutMs: 8000,
};

import type {
	CommentEmojiConfig,
	CommentEmojiPack,
	CommentEmojiSource,
} from "@/shared/types/comments";
import huoying from "../../../../public/assets/emoji/huoying.json";

/**
 * 评论区表情包
 * ---------------------------------------------------------------------------
 * 一份 JSON = 一个系列 = 面板里的一个 tab。JSON 由桌面端 EmojiJsonEditor 生成，
 * 和图片一起放在 public/assets/emoji/ 下（<系列>.json 挨着 <系列>/ 图片文件夹），
 * 编辑器填的「基础地址」就是图片目录在站点里的路径。
 *
 * 加一个新系列：
 *   1. 图片丢进 public/assets/emoji/<系列>/；
 *   2. 用编辑器导出 <系列>.json，放到 public/assets/emoji/ 下；
 *   3. 在下面 packs 里加一行 packOf(...)，标签写中文名。
 * 组件不用改：tab 按 packs 生成，只有一个系列时不显示 tab 栏。
 *
 * 面板格子完全跟随 emoji：同一套 8 列网格、同一个 .tg-emoji-item 尺寸，
 * 图片按 contain 填满格子 —— 面板里多大不在这里配。
 *
 * size 只决定**输入框里和气泡里**那张的边长，取第一个系列的 defaultSize.width：
 * 24 和正文行高接近，表情混在文字里像大号 emoji，不会把行撑开。
 */
function packOf(source: CommentEmojiSource, label: string): CommentEmojiPack {
	// basePath 由编辑器保证以 / 结尾，这里再兜一次，省得漏了斜杠拼出 hy-1.webp 贴在包名后面
	const base = source.basePath.endsWith("/")
		? source.basePath
		: `${source.basePath}/`;
	return {
		id: source.category,
		label,
		size: source.defaultSize?.width || 24,
		items: source.data.map((entry) => ({
			id: entry.id,
			// 标题为空时退回文件名，至少按钮上有个能读的东西
			name: entry.title?.trim() || entry["file-name"],
			src: base + entry["file-name"],
		})),
	};
}

const packs: CommentEmojiPack[] = [
	packOf(huoying as CommentEmojiSource, "火影"),
];

export const commentEmojiConfig: CommentEmojiConfig = {
	size: packs[0]?.size ?? 24,
	packs,
};

import type {
	CommentWallpaperConfig,
	CommentWallpaperItem,
} from "@/shared/types/comments";

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
 * 播放逻辑见 components/comment/comment-wallpaper.ts —— 它只播一遍再停末帧，
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
export function getCommentWallpaper(id?: string | null): CommentWallpaperItem {
	const { wallpapers, defaultId } = commentWallpaperConfig;
	return (
		wallpapers.find((item) => item.id === id) ??
		wallpapers.find((item) => item.id === defaultId) ??
		wallpapers[0]
	);
}
