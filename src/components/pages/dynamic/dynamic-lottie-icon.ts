/**
 * 动态卡片里的图标动画：点赞爱心 / 评论气泡
 * ---------------------------------------------------------------------------
 * 用自定义元素 <dynamic-lottie-icon data-animation="like-heart"> 实现，原因有三：
 *   1. 动态页条目是服务端渲染的静态 HTML，Svelte 岛在这里没法按条水合；
 *   2. 侧栏弹窗里的条目是 template 克隆出来的，元素级监听和岛都会丢；
 *   3. 自定义元素写一次，页面、模板克隆、Svelte 弹窗三处都能用同一份逻辑。
 *
 * 性能：lottie-web 与 JSON 都是按需动态加载；元素进入视口（提前 120px）才初始化，
 * 一屏只会有两三个实例，其余条目滚到才建。动画只播一次（loop:false），
 * 停在最后一帧当作静止图标。
 */

/** 素材名 → 文件，放 src/assets/lottie 下，新增动画只要加进这个目录并被 data-animation 引用 */
const animations = import.meta.glob("../../../assets/lottie/*.json", {
	import: "default",
});

interface LottiePlayer {
	play: () => void;
	goToAndStop: (value: number, isFrame?: boolean) => void;
	setSpeed?: (speed: number) => void;
	destroy: () => void;
}

/** 整个页面只加载一次 lottie-web */
let lottiePromise: Promise<{
	loadAnimation: (config: Record<string, unknown>) => LottiePlayer;
}> | null = null;

/** 同一份 JSON 全站只取一次 */
const dataCache = new Map<string, Promise<{ op?: number }>>();

function loadLottie() {
	if (!lottiePromise) {
		lottiePromise = import("lottie-web").then(
			(module) =>
				module.default as unknown as {
					loadAnimation: (config: Record<string, unknown>) => LottiePlayer;
				},
		);
	}
	return lottiePromise;
}

function loadAnimationData(name: string): Promise<{ op?: number }> | null {
	const loader = animations[`../../../assets/lottie/${name}.json`];
	if (!loader) return null;
	let cached = dataCache.get(name);
	if (!cached) {
		cached = loader() as Promise<{ op?: number }>;
		dataCache.set(name, cached);
	}
	return cached;
}

function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 自定义元素类必须定义在函数体内：`class X extends HTMLElement` 在模块求值时就会
 * 读取 HTMLElement，而 Svelte 岛在服务端渲染时同样会 import 这个模块 ——
 * 顶层定义会让 SSR 直接抛 ReferenceError: HTMLElement is not defined。
 */
function defineElement(): void {
	class DynamicLottieIcon extends HTMLElement {
		private player: LottiePlayer | null = null;
		private observer: IntersectionObserver | null = null;
		/** 动画末帧：静止状态就停在这一帧 */
		private lastFrame = 0;
		/** 初始化完成前点了按钮，先把播放请求记下来 */
		private pendingPlay = false;
		private initializing = false;
		private ready = false;

		connectedCallback() {
			if (this.initializing || this.ready) return;
			this.setAttribute("aria-hidden", "true");

			// 提前 120px 预热：滚到一半时图标已经画好，不会出现空白
			this.observer = new IntersectionObserver(
				(entries) => {
					if (!entries.some((entry) => entry.isIntersecting)) return;
					this.observer?.disconnect();
					this.observer = null;
					void this.init();
				},
				{ rootMargin: "120px" },
			);
			this.observer.observe(this);
		}

		disconnectedCallback() {
			this.observer?.disconnect();
			this.observer = null;
		}

		/** 播一次：从第一帧跑到末帧（爱心弹出 + 粒子） */
		play(): void {
			if (!this.ready) {
				this.pendingPlay = true;
				return;
			}
			if (!this.player || prefersReducedMotion()) return;
			this.player.goToAndStop(0, true);
			this.player.play();
		}

		private async init(): Promise<void> {
			if (this.initializing) return;
			this.initializing = true;

			const name = this.dataset.animation;
			const data$ = name ? loadAnimationData(name) : null;
			if (!data$ || !this.isConnected) {
				this.initializing = false;
				return;
			}

			try {
				const [lottie, data] = await Promise.all([loadLottie(), data$]);
				if (!this.isConnected) {
					this.initializing = false;
					return;
				}
				this.lastFrame = Math.max(0, (data.op ?? 1) - 1);

				this.player = lottie.loadAnimation({
					container: this,
					renderer: "svg",
					loop: false,
					autoplay: false,
					animationData: structuredClone(data),
					rendererSettings: {
						preserveAspectRatio: "xMidYMid meet",
						progressiveLoad: false,
					},
				});
				// 静止在末帧：爱心是完整的心，评论是完整的气泡
				this.player.goToAndStop(this.lastFrame, true);
				// 评论素材只有 6 帧（0.1s），原速播等于闪一下，所以支持 data-speed 放慢
				const speed = Number(this.dataset.speed ?? "");
				if (Number.isFinite(speed) && speed > 0 && speed !== 1) {
					this.player.setSpeed?.(speed);
				}
				this.ready = true;
				this.dataset.ready = "true";

				if (this.pendingPlay) {
					this.pendingPlay = false;
					this.play();
				}
			} catch {
				// 动画挂掉也不影响按钮本身，留一个空占位就行
				this.initializing = false;
			}
		}
	}

	customElements.define("dynamic-lottie-icon", DynamicLottieIcon);
}

/** 全局样式只注入一次：尺寸用 1em，容器改 font-size 就能缩放 */
let styled = false;
function injectStyles(): void {
	if (styled || typeof document === "undefined") return;
	styled = true;
	// dev 下模块可能被两个岛各实例化一份，用 DOM 标记兜底，避免重复插入 <style>
	if (document.querySelector("style[data-dynamic-lottie]")) return;
	const style = document.createElement("style");
	style.dataset.dynamicLottie = "true";
	style.textContent = `
dynamic-lottie-icon {
	display: inline-block;
	flex: none;
	width: 1em;
	height: 1em;
	line-height: 0;
	transition: filter 0.18s ease, opacity 0.18s ease;
}
dynamic-lottie-icon svg {
	display: block;
	width: 100%;
	height: 100%;
	/* 素材画布留白很多，按内容实际占比放大；--lottie-zoom 可以按素材覆盖。
	   必须 !important —— lottie 会给 <svg> 写内联 transform: translate3d(0,0,0) */
	transform: scale(var(--lottie-zoom, 1)) !important;
	transform-origin: 50% 50%;
}

/* 爱心：素材本体只占画布 24%，放大 3.2 倍后接近正常图标大小；
   点赞瞬间会弹到 34%，略微溢出容器就是「跳出来」的效果，不做裁切。
   未点赞时和评论气泡保持同一套配色：浅色压成深灰，暗色反白，
   所以用 brightness(0) 压黑后暗色再 invert(1)，而不是 grayscale —— 素材是红心，
   grayscale 出来是浅灰，和气泡的深灰对不上 */
dynamic-lottie-icon[data-animation="like-heart"] {
	--lottie-zoom: 3.2;
	filter: brightness(0);
	opacity: 0.55;
}
:root.dark dynamic-lottie-icon[data-animation="like-heart"] {
	filter: brightness(0) invert(1);
	opacity: 0.8;
}
/* 已点赞：放回素材本身的彩色（红心）。暗色规则多了 :root.dark 一级，
   这里必须同样带上，否则会被上面那条压住 */
.is-active dynamic-lottie-icon[data-animation="like-heart"],
:root.dark .is-active dynamic-lottie-icon[data-animation="like-heart"] {
	filter: none;
	opacity: 1;
}

/* 气泡素材是 Telegram 的白色贴纸图标，本身已占满画布，不用放大。
   浅色主题压成深灰，暗色主题保持白 */
dynamic-lottie-icon[data-animation="comment-chats"] {
	filter: brightness(0);
	opacity: 0.55;
}
:root.dark dynamic-lottie-icon[data-animation="comment-chats"] {
	filter: none;
	opacity: 0.8;
}
`;
	document.head.append(style);
}

export function registerDynamicLottieIcons(): void {
	if (typeof window === "undefined") return;
	injectStyles();
	if (!customElements.get("dynamic-lottie-icon")) defineElement();
}
