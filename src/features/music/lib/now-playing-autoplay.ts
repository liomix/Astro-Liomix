/**
 * 「进入站点自动播放」开关：存 localStorage，设置面板写入、MusicManager 初始化时读一次。
 * `musicPlayerConfig.autoPlay` 只是没存过时的默认值，用户在这里改过就以存下来的为准。
 *
 * 值写成 "1" / "0"：MusicManager 是内联脚本，没法 import，用同样的字面量判断。
 */

export const AUTOPLAY_STORAGE_KEY = "music-player-autoplay";
export const AUTOPLAY_EVENT = "fm:autoplay";
export const AUTOPLAY_DEFAULT = false;

export type AutoPlayEventDetail = { autoPlay: boolean };

export function readAutoPlay(fallback: boolean = AUTOPLAY_DEFAULT): boolean {
	if (typeof localStorage === "undefined") return fallback;
	try {
		const raw = localStorage.getItem(AUTOPLAY_STORAGE_KEY);
		if (raw === "1") return true;
		if (raw === "0") return false;
		return fallback;
	} catch {
		return fallback;
	}
}

/** 存盘并广播；下次进站（管理器 init）才生效，本次播放不受影响 */
export function saveAutoPlay(value: boolean): boolean {
	try {
		localStorage.setItem(AUTOPLAY_STORAGE_KEY, value ? "1" : "0");
	} catch {
		// 隐私模式下写不进去就只在本次会话生效
	}
	window.dispatchEvent(
		new CustomEvent<AutoPlayEventDetail>(AUTOPLAY_EVENT, {
			detail: { autoPlay: value },
		}),
	);
	return value;
}
