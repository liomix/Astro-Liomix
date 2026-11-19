/**
 * 左下角播放条的毛玻璃强度。
 * 存 localStorage，卡片与播放设置面板通过 fm:glass 事件同步（不经过 MusicManager，
 * 因为它只管音频）。0 表示关闭玻璃，卡片退回实色底。
 */

export const GLASS_STORAGE_KEY = "music-player-glass-blur";
export const GLASS_EVENT = "fm:glass";
export const GLASS_BLUR_MIN = 0;
export const GLASS_BLUR_MAX = 24;
export const GLASS_BLUR_DEFAULT = 16;

export type GlassEventDetail = { blur: number };

export function clampGlassBlur(value: number): number {
	if (!Number.isFinite(value)) return GLASS_BLUR_DEFAULT;
	return Math.min(GLASS_BLUR_MAX, Math.max(GLASS_BLUR_MIN, Math.round(value)));
}

export function readGlassBlur(): number {
	if (typeof localStorage === "undefined") return GLASS_BLUR_DEFAULT;
	try {
		const raw = localStorage.getItem(GLASS_STORAGE_KEY);
		if (raw === null) return GLASS_BLUR_DEFAULT;
		return clampGlassBlur(Number.parseFloat(raw));
	} catch {
		return GLASS_BLUR_DEFAULT;
	}
}

/** 存盘并广播，让已挂载的播放条立刻跟着变 */
export function saveGlassBlur(value: number): number {
	const next = clampGlassBlur(value);
	try {
		localStorage.setItem(GLASS_STORAGE_KEY, String(next));
	} catch {
		// 隐私模式下写不进去就只在本次会话生效
	}
	window.dispatchEvent(
		new CustomEvent<GlassEventDetail>(GLASS_EVENT, {
			detail: { blur: next },
		}),
	);
	return next;
}
