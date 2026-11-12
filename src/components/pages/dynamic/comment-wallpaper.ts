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
 * 关于「素材不是循环动画」：
 *   所有图层都是 ip=0 / op=末帧的一次性「涂鸦逐个长出」，首帧基本空白、末帧才铺满。
 *   loop 会在回绕处从满屏跳回空白，看起来就是每圈闪一下。所以这里**只画末帧**，
 *   播完的状态一次到位；之后交给 CSS 的极缓缩放位移维持「活着」的感觉
 *   （telegram-chat.css 的 tg-wallpaper-drift）。
 *
 * 为什么不播生长：
 *   抽屉一滑出来，壁纸就该是成品 —— 播生长的话，打开抽屉先看到一片空白、再看着它
 *   长满，等于「先开抽屉、壁纸后出现」。素材的开场在这里只能帮倒忙，所以首帧直接跳末帧。
 *
 * 关于「换壁纸」：
 *   不是把旧 canvas 拆了再画新的（中间会露出壁纸层底色，闪一下）。新壁纸先叠在旧壁纸
 *   上面画好、落到末帧，再撤掉「透明待命」标记显形、再拆旧层 —— 交接过程一帧空白都没有。
 *   整个过程没有 opacity 过渡：淡入本身就是一次「底色→壁纸」的可见变化。
 *
 * 性能：
 *   - lottie-web 与几 MB 的 JSON 都按需加载：悬浮 / 聚焦评论按钮时，抽屉会先把 iframe
 *     建好并在后台加载（dynamic-comment-drawer.ts 的 prewarmDrawer），等真正点开时
 *     壁纸已经画好了 —— 这也是「打开即成品」的另一半。
 *   - 只画一帧就停，没有逐帧 rAF：整帧上千层画一遍要 10ms 上下，之后的「动」
 *     全交给合成层的 CSS 变换。
 *   - prefers-reduced-motion：同样画末帧，只是不漂移。
 */

import {
	COMMENT_WALLPAPER_STORAGE_KEY,
	commentWallpaperConfig,
	getCommentWallpaper,
} from "@/config/commentWallpaperConfig";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");

/** 素材帧率，只在拿不到 totalFrames 时兜底 */
const SOURCE_FPS = 120;

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

/**
 * 某张壁纸的垫底色（取色板第一个色，见 commentWallpaperConfig）。
 * 评论页自己用 applyWallpaperTint 写进根节点；父窗口拿它给 iframe 那层补底色 ——
 * iframe 里的文档还没到之前，浏览器给 iframe 的默认垫底是白的。
 */
export function getChatWallpaperTint(id?: string | null): string {
	return getCommentWallpaper(id).colors[0] || "";
}

/**
 * 把壁纸垫底色写进 <html> 的 --tg-wallpaper-tint。
 *
 * 这是「画布还没画上 / 还差一两帧」时露的那层色，取配置里的第一个色（最接近成品
 * 整体明度的那个）。用它垫底，空窗露出来的是壁纸的色调，而不是一块白。
 *
 * 深色下清掉这个变量：深色底本身就不是白，而浅色垫底会把 opacity .5 的画布照亮，
 * 夜间整块发亮。CSS 里所有用到它的地方都带 var(--tg-chat-bg) 兜底，清掉即回退。
 *
 * 为什么挂在根节点而不是壁纸层上：主题可以在运行时切换，切换时要重算一次 ——
 * 挂在根节点 + 留一个重算入口，才不会留下一份过期的浅色垫底。
 */
export function applyWallpaperTint(id?: string | null): void {
	const root = document.documentElement;
	const tint = root.classList.contains("dark")
		? ""
		: getChatWallpaperTint(id ?? storedWallpaperId());
	if (tint) root.style.setProperty("--tg-wallpaper-tint", tint);
	else root.style.removeProperty("--tg-wallpaper-tint");
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

function lastFrame(view: WallpaperView): number {
	const animation = view.animation;
	if (!animation) return 0;
	return Math.max(1, Math.round(animation.totalFrames || SOURCE_FPS) - 1);
}

function destroyView(view: WallpaperView): void {
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
 * 画一张壁纸：直接落到末帧。
 * 这里刻意不播生长 —— 抽屉滑出来时壁纸就该是成品，见文件头。
 */
async function paint(chat: HTMLElement, id: string): Promise<void> {
	const token = ++paintToken;
	const src = getChatWallpaperSrc(id);

	const [player, data] = await Promise.all([loadPlayer(), loadWallpaperData(src)]);
	// 页面已经切走 / 又换了另一张 / 壁纸已卸载：别把动画挂到孤儿节点上
	if (token !== paintToken || !chat.isConnected) return;
	if (!data) return;

	const previous = current?.chat === chat ? current : null;
	const existing = previous ? null : findIdleLayer(chat);
	const layer = existing ?? createLayer();
	// 垫底色跟着这张壁纸走：万一画布要晚一两帧，露出来的是壁纸的色调，不是白
	applyWallpaperTint(id);
	// 新层叠在旧层之上（两层同为 z-index: 0，DOM 顺序靠后的压在上面）。
	// 换壁纸时先设成 pending（透明）：它还在画、画完末帧才显形，中间透出的是
	// 下面那张旧壁纸 —— 不会有一帧纯色垫底盖在旧图上
	if (previous) {
		layer.dataset.pending = "true";
		previous.view.layer.after(layer);
	} else if (!existing) {
		chat.prepend(layer);
	}

	const view: WallpaperView = {
		layer,
		animation: null,
		observer: null,
		resizeRaf: 0,
	};

	try {
		view.animation = player.loadAnimation({
			container: layer,
			renderer: "canvas",
			// 不循环、不自动播：末帧由下面那句 goToAndStop 一次性画出来
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

	// 直接画末帧：打开抽屉的第一眼就该是成品图，不是一片空白慢慢长满
	view.animation.goToAndStop(lastFrame(view), true);
	// data-bloom 只表示「已经画完」，CSS 靠它挂上极缓的漂移
	layer.dataset.bloom = "done";
	// 末帧已经在画布上了：撤掉 pending，这一层立刻带上自己的垫底色，不再透出旧层。
	// 这里没有任何 opacity 过渡 —— 上一版那 400ms 淡入就是「白色过渡」的来源
	layer.removeAttribute("data-pending");

	// 旧层多留一帧再撤：等浏览器把新画布合成上去，交接期间一直有东西垫在下面
	if (previous) {
		const retired = previous.view;
		requestAnimationFrame(() => {
			retired.layer.remove();
			destroyView(retired);
		});
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
		// 已经挂过：只有选中的壁纸换了才重画
		if (target.id === current.id) return;
		void paint(chat, target.id);
		return;
	}
	void paint(chat, target.id);
}

/** 换壁纸：新层画好末帧后交叉淡入，旧层等淡完再拆 */
export function setChatWallpaper(id: string): void {
	const chat =
		current?.chat ?? document.querySelector<HTMLElement>("[data-tg-chat]");
	if (!chat) return;
	const target = getCommentWallpaper(id);
	if (current?.chat === chat && current.id === target.id) return;
	void paint(chat, target.id);
}
