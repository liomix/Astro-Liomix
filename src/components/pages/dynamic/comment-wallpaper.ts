/**
 * 评论聊天区的壁纸
 * ---------------------------------------------------------------------------
 * 素材：public/lottie/comment-wallpaper-*.json（1024×1024、120 帧、上千个矢量图层），
 * 可选的那几张登记在 config/commentWallpaperConfig.ts，访客在「设置 → 壁纸」里挑，
 * 选中的 id 存在 localStorage。
 *
 * 为什么画在聊天页自己身上，而不是抽屉（父窗口）里：
 *   顶栏与输入栏要「壁纸的高斯模糊」，而 backdrop-filter 只采样**同一个 document**
 *   里画在它下面的东西。现在壁纸、顶栏、消息区、输入栏全在 /dynamic/comments/ 这一个
 *   文档里，模糊天然成立；父窗口那层抽屉只剩外壳（圆角 + 滑入 + 阴影），连
 *   「让 iframe 变透明」这种非标准依赖都不需要了。
 *
 * 关于「闪烁」：
 *   这些素材都是一次性的「涂鸦逐个长出」——所有图层 ip=0 / op=末帧，首帧基本空白、
 *   末帧才铺满。loop 会在回绕处从满屏跳回空白，看起来就是每圈闪一下。所以只播一遍、
 *   停在末帧，之后交给 CSS 的极缓缩放位移维持「活着」的感觉（telegram-chat.css 的
 *   tg-wallpaper-drift）。
 *
 * 关于「换壁纸」：
 *   不是把旧 canvas 拆了再画新的（中间会露出壁纸层底色，闪一下）。新壁纸先叠在旧壁纸
 *   上面画好、直接落到末帧，再淡入、再拆旧层 —— 交接过程一帧空白都没有，而且换壁纸
 *   不需要重播生长动画。
 *
 * 关于「生长只播一次」：
 *   每张壁纸各播一遍生长，播过就记进 localStorage（键 comment-wallpaper-bloomed），
 *   所以换另一条动态（iframe 重载）、整页刷新都不会再重播。这个标记必须存在 iframe
 *   之外：每次重载都是一个全新的 JS 上下文，模块里的 bloomed 一定归零。
 *   在设置里换到另一张时走即时交叉淡入、不播生长 —— 一次切换不该让人干等 2.6 秒；
 *   那张壁纸的「第一次生长」留给它下次作为新文档的壁纸被加载时。
 *
 * 性能：
 *   - lottie-web 与几 MB 的 JSON 都按需加载：抽屉首次展开时 iframe 才创建，壁纸跟着
 *     这个页面一起加载；悬浮评论按钮时抽屉会先发一条 prefetch 提示，把当前那张预热进
 *     HTTP 缓存（dynamic-comment-drawer.ts）。
 *   - 用 rAF 推进帧并限到 30fps（整帧上千层画一遍要 10ms 上下，跑满 60fps 会拖慢
 *     消息区滚动）；标签页切走时 rAF 自动停，回来时进度已过 1，直接落末帧。
 *   - 长完之后立刻取消 rAF，不再重绘 canvas —— 之后的「动」交给合成层的 CSS 变换。
 *   - prefers-reduced-motion：直接画末帧，不播、也不漂移。
 */

import {
	COMMENT_WALLPAPER_STORAGE_KEY,
	commentWallpaperConfig,
	getCommentWallpaper,
} from "@/config/commentWallpaperConfig";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");

/** 素材帧率，只在拿不到 totalFrames 时兜底 */
const SOURCE_FPS = 120;
/** 把素材原本 1 秒的生长拉长到 2.6 秒：够从容，又不至于让人盯着等 */
const BLOOM_MS = 2600;
/** 生长动画的重绘上限，见文件头 */
const PLAYBACK_FPS = 30;
/** 两帧之间的最小间隔（毫秒） */
const FRAME_INTERVAL = 1000 / PLAYBACK_FPS;
/** 换壁纸时旧层的淡出时长，跟 telegram-chat.css 里 .tg-wallpaper 的过渡对齐 */
const HANDOVER_MS = 460;
/** 已经播过生长的壁纸 id（JSON 数组）：跨 iframe 重载与整页刷新都有效 */
const BLOOMED_STORAGE_KEY = "comment-wallpaper-bloomed";

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

/** 一层壁纸（一个 canvas）自己的状态：换壁纸时新旧两层会短暂共存 */
interface WallpaperView {
	layer: HTMLElement;
	animation: LottieAnimation | null;
	/** 抽屉宽度随视口变化，容器一变就得让 lottie 按新尺寸重排 */
	observer: ResizeObserver | null;
	resizeRaf: number;
	raf: number;
	/** 生长动画已播完，停在末帧，之后只做 CSS 漂移 */
	bloomed: boolean;
}

interface WallpaperEntry {
	chat: HTMLElement;
	id: string;
	view: WallpaperView;
}

/** 一个文档只有一块聊天区，只记当前这一个 */
let current: WallpaperEntry | null = null;
/** 连续切换时，只有最后一次的结果允许落到 DOM 上 */
let paintToken = 0;
let playerPromise: Promise<LottiePlayer> | null = null;
/** 按地址缓存的 JSON：切回用过的壁纸不用再下一次 */
const dataCache = new Map<string, Promise<unknown>>();

/** 某张壁纸的完整地址（带 BASE_URL） */
export function getChatWallpaperSrc(id?: string | null): string {
	return `${BASE}${getCommentWallpaper(id).src}`;
}

function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 访客选中的那张：直接读 localStorage，不必把整个 setting-utils 拉进这个页面 */
function storedWallpaperId(): string {
	if (!commentWallpaperConfig.switchable) return getCommentWallpaper(null).id;
	try {
		return getCommentWallpaper(
			localStorage.getItem(COMMENT_WALLPAPER_STORAGE_KEY),
		).id;
	} catch {
		return getCommentWallpaper(null).id;
	}
}

/**
 * 播过生长的壁纸 id 集合。
 * localStorage 读不出来（隐私模式 / 被禁用）就退回内存版：本文件的这一次加载里
 * 仍然只播一遍，只是下次重载会再播 —— 多播一次总比一直不播好。
 */
let bloomedIds: Set<string> | null = null;

function readBloomedIds(): Set<string> {
	if (bloomedIds) return bloomedIds;
	const ids = new Set<string>();
	try {
		const raw = localStorage.getItem(BLOOMED_STORAGE_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : null;
		if (Array.isArray(parsed)) {
			for (const item of parsed) {
				if (typeof item === "string") ids.add(item);
			}
		}
	} catch {
		// 坏数据或不可用：当作没播过
	}
	bloomedIds = ids;
	return ids;
}

function hasBloomed(id: string): boolean {
	return readBloomedIds().has(id);
}

function markBloomed(id: string): void {
	const ids = readBloomedIds();
	if (ids.has(id)) return;
	ids.add(id);
	try {
		// 顺手清掉配置里已经删掉的 id，别让这个键越积越长
		const known = new Set(commentWallpaperConfig.wallpapers.map((w) => w.id));
		const keep = [...ids].filter((item) => known.has(item));
		localStorage.setItem(BLOOMED_STORAGE_KEY, JSON.stringify(keep));
	} catch {
		// 存不进去只影响「下次还会再播一遍」，不影响画面
	}
}

function loadPlayer(): Promise<LottiePlayer> {
	if (!playerPromise) {
		playerPromise = import("lottie-web").then(
			(module) => module.default as unknown as LottiePlayer,
		);
	}
	return playerPromise;
}

/** 几 MB 的动画 JSON：同一张只取一次，失败就静默放弃（CSS 里的底色兜底） */
function loadWallpaperData(src: string): Promise<unknown> {
	let pending = dataCache.get(src);
	if (!pending) {
		pending = fetch(src, { cache: "force-cache" })
			.then((response) => {
				if (response.ok) return response.json();
				// 4xx / 5xx 不能留在缓存里，否则这张壁纸从此永远加载不出来
				dataCache.delete(src);
				return null;
			})
			.catch((error) => {
				console.warn("[chat-wallpaper] 壁纸加载失败", src, error);
				dataCache.delete(src);
				return null;
			});
		dataCache.set(src, pending);
	}
	return pending;
}

function stopRaf(view: WallpaperView): void {
	if (!view.raf) return;
	cancelAnimationFrame(view.raf);
	view.raf = 0;
}

function lastFrame(view: WallpaperView): number {
	const animation = view.animation;
	if (!animation) return 0;
	return Math.max(1, Math.round(animation.totalFrames || SOURCE_FPS) - 1);
}

/**
 * 播一遍生长动画：首帧 → 末帧，播完停在末帧并打上 data-bloom="done"，
 * 之后的画面靠 CSS 的漂移维持动感。
 */
function startBloom(view: WallpaperView): void {
	const animation = view.animation;
	if (!animation || view.raf || view.bloomed) return;

	const end = lastFrame(view);
	const from = Math.min(Math.max(animation.currentFrame || 0, 0), end);
	const startedAt = performance.now() - (from / end) * BLOOM_MS;
	let paintedAt = 0;

	const tick = (now: number): void => {
		const progress = (now - startedAt) / BLOOM_MS;
		if (progress >= 1) {
			view.raf = 0;
			view.bloomed = true;
			animation.goToAndStop(end, true);
			view.layer.dataset.bloom = "done";
			return;
		}
		// rAF 是 60/120Hz，这里按上限抽帧，别把整帧重绘跑满刷新率
		if (now - paintedAt >= FRAME_INTERVAL) {
			paintedAt = now;
			animation.goToAndStop(Math.round(progress * end), true);
		}
		view.raf = requestAnimationFrame(tick);
	};

	view.raf = requestAnimationFrame(tick);
}

function destroyView(view: WallpaperView): void {
	stopRaf(view);
	if (view.resizeRaf) cancelAnimationFrame(view.resizeRaf);
	view.resizeRaf = 0;
	view.observer?.disconnect();
	view.observer = null;
	view.animation?.destroy();
	view.animation = null;
}

/** 容器尺寸变了就重排：抽屉宽度跟着视口走，不重排 canvas 会被 CSS 拉伸糊掉 */
function observeSize(view: WallpaperView): void {
	view.observer = new ResizeObserver(() => {
		if (view.resizeRaf) cancelAnimationFrame(view.resizeRaf);
		view.resizeRaf = requestAnimationFrame(() => {
			view.resizeRaf = 0;
			view.animation?.resize();
		});
	});
	view.observer.observe(view.layer);
}

function createLayer(): HTMLElement {
	const layer = document.createElement("div");
	layer.className = "tg-wallpaper";
	layer.dataset.tgWallpaper = "";
	layer.setAttribute("aria-hidden", "true");
	return layer;
}

/** 服务端渲染好的那层空容器（还没画过东西）：首次挂载直接用它，别在旁边多堆一个 */
function findIdleLayer(chat: HTMLElement): HTMLElement | null {
	const layer = chat.querySelector<HTMLElement>("[data-tg-wallpaper]");
	return layer && !layer.querySelector("canvas") ? layer : null;
}

/**
 * 画一张壁纸。
 * @param replay 是否播生长动画：这张壁纸还没播过、且是首次挂载才播；
 *   换壁纸走即时落末帧（那张的第一次生长留给它下次作为新文档壁纸被加载时）
 */
async function paint(
	chat: HTMLElement,
	id: string,
	replay: boolean,
): Promise<void> {
	const token = ++paintToken;
	const src = getChatWallpaperSrc(id);

	const [player, data] = await Promise.all([loadPlayer(), loadWallpaperData(src)]);
	// 页面已经切走 / 又换了另一张 / 壁纸已卸载：别把动画挂到孤儿节点上
	if (token !== paintToken || !chat.isConnected) return;
	if (!data) return;

	const previous = current?.chat === chat ? current : null;
	const existing = previous ? null : findIdleLayer(chat);
	const layer = existing ?? createLayer();
	// 新层叠在旧层之上（两层同为 z-index: 0，DOM 顺序靠后的压在上面）：
	// 它画好、淡入之后才拆旧层，中间不会露出壁纸层底色
	if (previous) previous.view.layer.after(layer);
	else if (!existing) chat.prepend(layer);

	const view: WallpaperView = {
		layer,
		animation: null,
		observer: null,
		resizeRaf: 0,
		raf: 0,
		bloomed: false,
	};
	const reducedMotion = prefersReducedMotion();

	try {
		view.animation = player.loadAnimation({
			container: layer,
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
	} catch (error) {
		// 素材坏了：撤掉这一层，保持底色兜底，不阻塞聊天
		console.warn("[chat-wallpaper] 壁纸初始化失败", src, error);
		layer.remove();
		return;
	}

	observeSize(view);
	current = { chat, id, view };

	if (replay && !reducedMotion) {
		// 播之前就记账：中途关掉抽屉 / 切走页面，下次也不该从头再长一遍
		markBloomed(id);
		startBloom(view);
	} else {
		// 换壁纸 / 少动画偏好：直接把末帧画出来
		view.bloomed = true;
		view.animation.goToAndStop(lastFrame(view), true);
		layer.dataset.bloom = "done";
	}

	// 淡入放在下一帧：先让浏览器吃到 data-ready 之前的那一帧（opacity: 0），
	// 与 data-ready 同帧写入的话过渡可能被合并掉，直接跳成不透明
	requestAnimationFrame(() => {
		if (token !== paintToken) return;
		layer.dataset.ready = "true";
	});

	// 旧层等新层淡完再撤：交接期间它一直垫在下面，用户看不到任何空白
	if (previous) {
		const retired = previous.view;
		window.setTimeout(() => {
			retired.layer.remove();
			destroyView(retired);
		}, HANDOVER_MS);
	}
}

/**
 * 聊天区挂好之后调一次：找（或补）一层壁纸容器并异步加载。
 * 容器由 TelegramChat.astro 服务端渲染，这里是兜底创建，
 * 免得哪天忘了写那行 div 就整块没反应。
 */
export function mountChatWallpaper(chat: HTMLElement, id?: string): void {
	const target = getCommentWallpaper(id ?? storedWallpaperId());
	if (current?.chat === chat && current.view.layer.isConnected) {
		// 已经挂过：只有选中的壁纸换了才重画，而且不重播生长动画
		if (target.id === current.id) return;
		void paint(chat, target.id, false);
		return;
	}
	// 换另一条动态（iframe 重载）会走到这里：这张壁纸播过就直接落末帧，
	// 没播过的才让它长一次 —— 状态记在 localStorage，模块变量在这里是靠不住的
	void paint(chat, target.id, !hasBloomed(target.id));
}

/**
 * 换壁纸：不播生长，直接交叉淡入到新那张。
 * 也刻意不写 bloomed 记录：切过去是即时换图，那张壁纸的「第一次生长」
 * 留给它下次作为新文档的壁纸被加载时，这样一次切换不会让人干等 2.6 秒。
 */
export function setChatWallpaper(id: string): void {
	const chat =
		current?.chat ?? document.querySelector<HTMLElement>("[data-tg-chat]");
	if (!chat) return;
	const target = getCommentWallpaper(id);
	if (current?.chat === chat && current.id === target.id) return;
	void paint(chat, target.id, false);
}
