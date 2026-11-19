/**
 * 音乐域：播放器、播放列表、正在播放卡片与播放设置。
 */

// 组件
export { default as MusicCard } from "./components/MusicCard.astro";
export { default as MusicManager } from "./components/MusicManager.astro";
export { default as MusicPlayer } from "./components/MusicPlayer.astro";
export { default as MusicPlayerView } from "./components/MusicPlayerView.astro";
export { default as NavMusicButton } from "./components/NavMusicButton.svelte";
export { default as NowPlayingCard } from "./components/NowPlayingCard.svelte";
export { default as PlaybackSettings } from "./components/PlaybackSettings.svelte";

// 配置
export { musicPlayerConfig } from "./config";
// 工具 / 契约
export { readEmbeddedCover } from "./lib/audio-cover";
export type { AutoPlayEventDetail } from "./lib/now-playing-autoplay";
export {
	AUTOPLAY_DEFAULT,
	AUTOPLAY_EVENT,
	AUTOPLAY_STORAGE_KEY,
	readAutoPlay,
	saveAutoPlay,
} from "./lib/now-playing-autoplay";
export type { GlassEventDetail } from "./lib/now-playing-glass";
export {
	clampGlassBlur,
	GLASS_BLUR_DEFAULT,
	GLASS_BLUR_MAX,
	GLASS_BLUR_MIN,
	GLASS_EVENT,
	GLASS_STORAGE_KEY,
	readGlassBlur,
	saveGlassBlur,
} from "./lib/now-playing-glass";
export {
	LYRICS_OPEN_DEFAULT,
	LYRICS_OPEN_STORAGE_KEY,
	readLyricsOpen,
	saveLyricsOpen,
} from "./lib/now-playing-lyrics";
export type { CardPersistEventDetail } from "./lib/now-playing-persist";
export {
	CARD_PERSIST_DEFAULT,
	CARD_PERSIST_EVENT,
	CARD_PERSIST_STORAGE_KEY,
	readCardPersistent,
	saveCardPersistent,
} from "./lib/now-playing-persist";
// 类型
export type { MusicPlayerConfig } from "./types";
