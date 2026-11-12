/**
 * 评论聊天区的壁纸
 * ---------------------------------------------------------------------------
 * 素材：public/lottie/comment-wallpaper.json（1024×1024、120 帧、1447 个矢量图层）。
 *
 * 为什么画在聊天页自己身上，而不是抽屉（父窗口）里：
 *   顶栏与输入栏要「壁纸的高斯模糊」，而 backdrop-filter 只采样**同一个 document**
 *   里画在它下面的东西。现在壁纸、顶栏、消息区、输入栏全在 /dynamic/comments/ 这一个
 *   文档里，模糊天然成立；父窗口那层抽屉只剩外壳（圆角 + 滑入 + 阴影），连
 *   「让 iframe 变透明」这种非标准依赖都不需要了。
 *
 * 关于「闪烁」：
 *   素材是一次性的「涂鸦逐个长出」——1447 个图层全部 ip=0 / op=120，首帧基本空白、
 *   末帧才铺满（各层入场时间散在 40~118 帧）。loop 会在回绕处从满屏跳回空白，看起来
 *   就是每圈闪一下。所以只播一遍、停在末帧，之后交给 CSS 的极缓缩放位移维持「活着」
 *   的感觉（telegram-chat.css 的 tg-wallpaper-drift）。
 *
 * 性能：
 *   - lottie-web 与 2.2MB 的 JSON 都按需加载：抽屉首次展开时 iframe 才创建，壁纸跟着
 *     这个页面一起加载；悬浮评论按钮时抽屉会先发一条 prefetch 提示，把 JSON 预热进
 *     HTTP 缓存（dynamic-comment-drawer.ts）。
 *   - 用 rAF 推进帧并限到 30fps（整帧 1447 层画一遍要 10ms 上下，跑满 60fps 会拖慢
 *     消息区滚动）；标签页切走时 rAF 自动停，回来时进度已过 1，直接落末帧。
 *   - 长完之后立刻取消 rAF，不再重绘 canvas —— 之后的「动」交给合成层的 CSS 变换。
 *   - prefers-reduced-motion：直接画末帧，不播、也不漂移。
 */

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");

/**
 * 壁纸地址。抽屉悬浮预热缓存时也用它，所以导出 —— 两边不能各写一份。
 * 改动这里等于同时改 iframe 的 fetch 与父窗口的 prefetch，不会走散。
 */
export const CHAT_WALLPAPER_SRC = `${BASE}/lottie/comment-wallpaper.json`;

/** 素材帧率，只在拿不到 totalFrames 时兜底 */
const SOURCE_FPS = 120;
/** 把素材原本 1 秒的生长拉长到 2.6 秒：够从容，又不至于让人盯着等 */
const BLOOM_MS = 2600;
/** 生长动画的重绘上限，见文件头 */
const PLAYBACK_FPS = 30;
/** 两帧之间的最小间隔（毫秒） */
const FRAME_INTERVAL = 1000 / PLAYBACK_FPS;

interface LottieAnimation {
	currentFrame: number;
	totalFrames: number;
	goToAndStop: (value: number, isFrame?: boolean) => void;
	resize: () => void;
	destroy: () => void;
}

interface LottiePlayer {
	loadAnimation: (config: Record<string, unknown>) => LottieAnimation;
}

interface WallpaperEntry {
	/** 壁纸层（.tg-wallpaper），canvas 由 lottie 塞进来 */
	layer: HTMLElement;
	animation: LottieAnimation | null;
	/** 抽屉宽度随视口变化，容器一变就得让 lottie 按新尺寸重排 */
	observer: ResizeObserver | null;
	resizeRaf: number;
	reducedMotion: boolean;
	raf: number;
	/** 生长动画已播完，停在末帧，之后只做 CSS 漂移 */
	bloomed: boolean;
}

/** 一个文档只有一块聊天区，只记当前这一个 */
let current: WallpaperEntry | null = null;
let playerPromise: Promise<LottiePlayer> | null = null;
let dataPromise: Promise<unknown> | null = null;

function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function loadPlayer(): Promise<LottiePlayer> {
	if (!playerPromise) {
		playerPromise = import("lottie-web").then(
			(module) => module.default as unknown as LottiePlayer,
		);
	}
	return playerPromise;
}

/** 2.2MB 的动画 JSON：整页只取一次，失败就静默放弃（CSS 里的底色兜底） */
function loadWallpaperData(): Promise<unknown> {
	if (!dataPromise) {
		dataPromise = fetch(CHAT_WALLPAPER_SRC, { cache: "force-cache" })
			.then((response) => (response.ok ? response.json() : null))
			.catch((error) => {
				console.warn("[chat-wallpaper] 壁纸加载失败", error);
				return null;
			});
	}
	return dataPromise;
}

function stopRaf(entry: WallpaperEntry): void {
	if (!entry.raf) return;
	cancelAnimationFrame(entry.raf);
	entry.raf = 0;
}

function lastFrame(entry: WallpaperEntry): number {
	const animation = entry.animation;
	if (!animation) return 0;
	return Math.max(1, Math.round(animation.totalFrames || SOURCE_FPS) - 1);
}

/**
 * 播一遍生长动画：首帧 → 末帧，播完停在末帧并打上 data-bloom="done"，
 * 之后的画面靠 CSS 的漂移维持动感。
 */
function startBloom(entry: WallpaperEntry): void {
	const animation = entry.animation;
	if (!animation || entry.raf || entry.bloomed) return;

	const end = lastFrame(entry);
	const from = Math.min(Math.max(animation.currentFrame || 0, 0), end);
	const startedAt = performance.now() - (from / end) * BLOOM_MS;
	let paintedAt = 0;

	const tick = (now: number): void => {
		const progress = (now - startedAt) / BLOOM_MS;
		if (progress >= 1) {
			entry.raf = 0;
			entry.bloomed = true;
			animation.goToAndStop(end, true);
			entry.layer.dataset.bloom = "done";
			return;
		}
		// rAF 是 60/120Hz，这里按上限抽帧，别把整帧重绘跑满刷新率
		if (now - paintedAt >= FRAME_INTERVAL) {
			paintedAt = now;
			animation.goToAndStop(Math.round(progress * end), true);
		}
		entry.raf = requestAnimationFrame(tick);
	};

	entry.raf = requestAnimationFrame(tick);
}

function destroyEntry(entry: WallpaperEntry): void {
	stopRaf(entry);
	if (entry.resizeRaf) cancelAnimationFrame(entry.resizeRaf);
	entry.resizeRaf = 0;
	entry.observer?.disconnect();
	entry.observer = null;
	entry.animation?.destroy();
	entry.animation = null;
	if (current === entry) current = null;
}

/** 容器尺寸变了就重排：抽屉宽度跟着视口走，不重排 canvas 会被 CSS 拉伸糊掉 */
function observeSize(entry: WallpaperEntry): void {
	entry.observer = new ResizeObserver(() => {
		if (entry.resizeRaf) cancelAnimationFrame(entry.resizeRaf);
		entry.resizeRaf = requestAnimationFrame(() => {
			entry.resizeRaf = 0;
			entry.animation?.resize();
		});
	});
	entry.observer.observe(entry.layer);
}

async function boot(entry: WallpaperEntry): Promise<void> {
	try {
		const [player, data] = await Promise.all([
			loadPlayer(),
			loadWallpaperData(),
		]);
		// 页面已经切走 / 壁纸层被换掉：别把动画挂到孤儿节点上
		if (!data || !entry.layer.isConnected || current !== entry) return;

		entry.animation = player.loadAnimation({
			container: entry.layer,
			renderer: "canvas",
			// 素材不是无缝循环（末帧满、首帧空），帧由自己的 rAF 推进
			loop: false,
			autoplay: false,
			animationData: data,
			rendererSettings: {
				clearCanvas: true,
				// slice = 像 background-size: cover 那样铺满，抽屉是瘦高条也不会留白
				preserveAspectRatio: "xMidYMid slice",
			},
		});

		if (entry.reducedMotion) {
			entry.bloomed = true;
			entry.animation.goToAndStop(lastFrame(entry), true);
			entry.layer.dataset.bloom = "done";
		} else {
			startBloom(entry);
		}

		observeSize(entry);
		// 动画就绪才淡入：没跑起来时露出的是壁纸层自己的底色，不是一块空 canvas
		entry.layer.dataset.ready = "true";
	} catch (error) {
		// 素材坏了 / 播放器加载失败：保持底色兜底，不阻塞聊天
		console.warn("[chat-wallpaper] 壁纸初始化失败", error);
	}
}

/**
 * 聊天区挂好之后调一次：找（或补）一层壁纸容器并异步加载。
 * 容器由 TelegramChat.astro 服务端渲染，这里是兜底创建，
 * 免得哪天忘了写那行 div 就整块没反应。
 */
export function mountChatWallpaper(chat: HTMLElement): void {
	if (current?.layer.isConnected && chat.contains(current.layer)) return;
	if (current) destroyEntry(current);

	let layer = chat.querySelector<HTMLElement>("[data-tg-wallpaper]");
	if (!layer) {
		layer = document.createElement("div");
		layer.className = "tg-wallpaper";
		layer.dataset.tgWallpaper = "";
		layer.setAttribute("aria-hidden", "true");
		chat.prepend(layer);
	}

	const entry: WallpaperEntry = {
		layer,
		animation: null,
		observer: null,
		resizeRaf: 0,
		reducedMotion: prefersReducedMotion(),
		raf: 0,
		bloomed: false,
	};
	current = entry;
	void boot(entry);
}
