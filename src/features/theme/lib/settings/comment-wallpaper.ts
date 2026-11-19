/**
 * 评论抽屉壁纸：访客选择、存储、跨窗口广播
 *
 * 由 setting-utils.ts 按职责拆出；对外仍经 setting-utils.ts 暴露，调用点不变。
 */
import {
	COMMENT_WALLPAPER_STORAGE_KEY,
	commentWallpaperConfig,
	getCommentWallpaper,
} from "@/shared/lib/comments/config";

// Declare global functions
declare global {
	interface Window {
		initSemifullScrollDetection?: () => void;
		semifullScrollHandler?: () => void;
	}
}

/** 默认那张：配置里的 defaultId，取不到就第一张 */
export function getDefaultCommentWallpaper(): string {
	return getCommentWallpaper(null).id;
}

/**
 * 访客选中的壁纸 id。
 * 存进去的值可能来自旧版本（那张壁纸已经被删了），所以一律拿配置校验一次再返回，
 * 保证调用方永远拿到一个能加载的 id。
 */
export function getStoredCommentWallpaper(): string {
	if (!commentWallpaperConfig.switchable) {
		return getDefaultCommentWallpaper();
	}
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultCommentWallpaper();
	}
	return getCommentWallpaper(
		localStorage.getItem(COMMENT_WALLPAPER_STORAGE_KEY),
	).id;
}

/**
 * 选择壁纸：写 localStorage + 广播 commentWallpaperChange。
 * 动态页的评论抽屉监听那个事件，把新 id 转给 iframe —— 抽屉里的壁纸
 * 是画在 iframe 自己的文档里的，父窗口没法直接改。
 */
export function setCommentWallpaper(id: string): void {
	const item = getCommentWallpaper(id);
	if (
		commentWallpaperConfig.switchable &&
		typeof localStorage !== "undefined" &&
		typeof localStorage.setItem === "function"
	) {
		localStorage.setItem(COMMENT_WALLPAPER_STORAGE_KEY, item.id);
	}
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent("commentWallpaperChange", {
				detail: { id: item.id },
			}),
		);
	}
}
