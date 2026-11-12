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
				// 短素材（几帧）原速播等于闪一下，需要慢放时用 data-speed。
				// 注意：评论气泡目前点击不播动画（见 dynamic-actions.ts 的 toggleComments），
				// 所以页面上已经没有地方用到它，能力保留给别的素材。
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

export function registerDynamicLottieIcons(): void {
	if (typeof window === "undefined") return;
	// 尺寸、放大倍率、配色全在 src/styles/lottie-icon.css（随 main.css 打包）。
	// 以前这里是运行时往 <head> 注入 <style>，Swup 换页时 head 被整份替换、
	// 注入的节点被删掉且不会补回，图标就会按素材原始 1080×1000 画成巨大红心。
	if (!customElements.get("dynamic-lottie-icon")) defineElement();
}
