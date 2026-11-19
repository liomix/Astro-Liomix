/**
 * 左下角播放条的歌词行开关。
 * 只有播放条自己用（播放设置面板里没有这一项），所以只存 localStorage、不发事件；
 * 与毛玻璃一样按「字符串写盘 + 宽容读」处理，隐私模式下写不进去就只在本会话生效。
 */

export const LYRICS_OPEN_STORAGE_KEY = "music-player-card-lyrics";
export const LYRICS_OPEN_DEFAULT = true;

export function readLyricsOpen(): boolean {
	if (typeof localStorage === "undefined") return LYRICS_OPEN_DEFAULT;
	try {
		return localStorage.getItem(LYRICS_OPEN_STORAGE_KEY) !== "0";
	} catch {
		return LYRICS_OPEN_DEFAULT;
	}
}

export function saveLyricsOpen(open: boolean): boolean {
	try {
		localStorage.setItem(LYRICS_OPEN_STORAGE_KEY, open ? "1" : "0");
	} catch {
		// 隐私模式下写不进去就只在本次会话生效
	}
	return open;
}
