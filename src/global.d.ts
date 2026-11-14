import type { SakuraManagerLike } from "./types/sakura-worker";
import type { WavesManagerLike } from "./types/waves";

declare global {
	interface HTMLElementTagNameMap {
		"table-of-contents": HTMLElement & {
			init?: () => void;
		};
	}

	interface Window {
		// biome-ignore lint/suspicious/noExplicitAny: External library
		swup: any;
		spineModelInitialized?: boolean;
		floatingTOCListenersInitialized?: boolean;
		// biome-ignore lint/suspicious/noExplicitAny: External library
		spinePlayerInstance?: any;
		pagefind: {
			search: (query: string) => Promise<{
				results: Array<{
					data: () => Promise<SearchResult>;
				}>;
			}>;
		};
		/** 按需加载 pagefind.js，由 Navbar.astro 的内联脚本挂载；幂等 */
		__loadPagefind?: () => Promise<void>;
		__pagefindLoading?: Promise<void>;
		/** 打开指定设置面板（设置菜单 / 主题设置 / 播放设置），由 utils/settings-panels.ts 挂载 */
		__settingsOpenPanel?: (
			id: "settings-menu" | "display-setting" | "playback-setting",
		) => void;
		/** 齿轮按钮：任意设置面板打开时全部收起，否则拉出设置菜单 */
		__settingsTogglePanels?: () => void;
		/** 设置面板初始化守卫，确保监听器只注册一次 */
		__settingsPanelsInit?: boolean;
		/** 站点访问统计初始化守卫（analytics/SiteVisitCounter.astro），确保 Swup 监听器只注册一次 */
		__siteStatsInit?: boolean;
		/** 文章阅读量初始化守卫（analytics/PostViewCounter.astro），确保 Swup 监听器只注册一次 */
		__postViewsInit?: boolean;
		__fireflyMusic?: {
			init: () => Promise<void>;
			getState: () => {
				playlist: Array<{
					name: string;
					artist: string;
					url: string;
					pic: string;
					lrc?: string;
				}>;
				currentIndex: number;
				track: {
					name: string;
					artist: string;
					url: string;
					pic: string;
					lrc?: string;
				} | null;
				isPlaying: boolean;
				playMode: number;
				volume: number;
				isMuted: boolean;
				/** 播放速度倍率，1 为原速 */
				playbackRate: number;
				currentTime: number;
				duration: number;
				progress: number;
				currentTimeStr: string;
				durationStr: string;
				lyrics: Array<{ time: number; text: string }>;
				currentLrcIndex: number;
				initialized: boolean;
				error: string | null;
				config: Record<string, unknown>;
			};
			togglePlay: () => void;
			playNext: () => void;
			playPrev: () => void;
			cyclePlayMode: () => void;
			/** 直接指定播放模式：0=列表循环 1=单曲循环 2=随机 */
			setPlayMode: (mode: number) => void;
			setVolume: (val: number) => void;
			toggleMute: () => void;
			/** 设置播放速度（0.5 ~ 2），会写入 localStorage */
			setPlaybackRate: (rate: number) => void;
			seek: (percent: number) => void;
			seekToTime: (time: number) => void;
			playTrackByIndex: (index: number) => void;
			loadTrack: (index: number, autoPlay: boolean) => void;
		};
		/** 樱花特效管理器,Worker 模式与主线程回退模式均实现该接口 */
		sakuraManager?: SakuraManagerLike;
		/** 樱花特效初始化守卫,确保只初始化一次(Swup 切页重跑脚本时复用) */
		sakuraInitialized?: boolean;
		/** 水波纹特效管理器(主线程 Canvas 2D 实现) */
		wavesManager?: WavesManagerLike;
		/** 水波纹特效初始化守卫,确保只初始化一次(Swup 切页重跑脚本时复用) */
		wavesInitialized?: boolean;
		/** 布局初始化守卫,确保 Swup 切页重跑模块脚本时只执行一次 */
		__fireflyLayoutInit?: boolean;
		/** 打字机特效监听器守卫,确保只注册一次 */
		__typewriterTextInit?: boolean;
		/** 多标签栏监听器守卫,确保只注册一次 */
		__tabBarInit?: boolean;
		/** 侧边栏目录监听器守卫,确保只注册一次 */
		__sidebarTOCInit?: boolean;
		/** 文章封面图监听器守卫,确保只注册一次 */
		__coverImageInit?: boolean;
		/** 悬浮目录自动关闭监听器守卫,确保只注册一次 */
		__floatingTOCAutoCloseInit?: boolean;
		/** 文章列表页布局监听器守卫,确保只注册一次 */
		__postPageInit?: boolean;
	}

	interface MediaQueryList {
		addListener(listener: (e: MediaQueryListEvent) => void): void;
		removeListener(listener: (e: MediaQueryListEvent) => void): void;
	}
}

interface SearchResult {
	url: string;
	meta: {
		title: string;
	};
	excerpt: string;
	content?: string;
	word_count?: number;
	filters?: Record<string, unknown>;
	anchors?: Array<{
		element: string;
		id: string;
		text: string;
		location: number;
	}>;
	weighted_locations?: Array<{
		weight: number;
		balanced_score: number;
		location: number;
	}>;
	locations?: number[];
	raw_content?: string;
	raw_url?: string;
	sub_results?: SearchResult[];
}

export type { SearchResult };
