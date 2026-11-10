/**
 * 左下角播放卡片是否「常驻」：开启后暂停 / 停止播放也不收起，卡片一直留在左下角。
 * 与玻璃强度一样存 localStorage，并通过 fm:card-persist 事件同步卡片与播放设置面板
 * （不经过 MusicManager，它只管音频）。
 */

export const CARD_PERSIST_STORAGE_KEY = "music-player-card-persistent";
export const CARD_PERSIST_EVENT = "fm:card-persist";
export const CARD_PERSIST_DEFAULT = true;

export type CardPersistEventDetail = { persistent: boolean };

export function readCardPersistent(): boolean {
	if (typeof localStorage === "undefined") return CARD_PERSIST_DEFAULT;
	try {
		const raw = localStorage.getItem(CARD_PERSIST_STORAGE_KEY);
		if (raw === null) return CARD_PERSIST_DEFAULT;
		return raw !== "false";
	} catch {
		return CARD_PERSIST_DEFAULT;
	}
}

/** 存盘并广播，让已挂载的播放条立刻跟着变 */
export function saveCardPersistent(value: boolean): boolean {
	try {
		localStorage.setItem(CARD_PERSIST_STORAGE_KEY, String(value));
	} catch {
		// 隐私模式下写不进去就只在本次会话生效
	}
	window.dispatchEvent(
		new CustomEvent<CardPersistEventDetail>(CARD_PERSIST_EVENT, {
			detail: { persistent: value },
		}),
	);
	return value;
}
