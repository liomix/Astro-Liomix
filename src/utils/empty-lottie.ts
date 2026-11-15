/**
 * 空状态插画：自定义元素 <empty-lottie>
 * ---------------------------------------------------------------------------
 * 全站所有「这里本来该有东西，但现在没有」的位置共用一个素材：`utyan_empty.json`
 * （src/assets/lottie 下，跟着 JS 一起打包，不进 public 的运行时目录）。
 *
 * 为什么是自定义元素而不是组件脚本：
 *   1. 空态出现在服务端渲染的页面里（404、友链、项目……），也在 Svelte 岛里
 *      （动态流），还在纯 JS 拼出来的 DOM 里（评论消息区）—— 自定义元素三处通用；
 *   2. 一次注册，多个实例各自独立，不会让每个实例都 import 一次 lottie-web。
 *
 * 性能与礼貌：
 *   - lottie-web 和 JSON 都是按需动态加载：页面没有空态就一个字节都不下；
 *   - 元素进入视口才初始化，离开视口暂停（空态在长列表末尾很常见）；
 *   - prefers-reduced-motion 时只画中间那一帧，不做循环动画。
 *
 * 尺寸不在这里定：元素铺满父容器，父容器由使用方用 `--empty-size` 决定
 * （见 components/common/EmptyState.astro 的 size 参数）。这样同一个素材在整页
 * 空态里可以大、在评论区里可以小。
 */

/** 素材名 → 文件。新增插画只要放进 src/assets/lottie 就能被 data-animation 引用 */
const animations = import.meta.glob("../assets/lottie/*.json", {
	import: "default",
});

interface LottiePlayer {
	play: () => void;
	pause: () => void;
	goToAndStop: (value: number, isFrame?: boolean) => void;
	destroy: () => void;
}

interface LottieData {
	op?: number;
}

let lottiePromise: Promise<{
	loadAnimation: (config: Record<string, unknown>) => LottiePlayer;
}> | null = null;

/** 同一份 JSON 全站只取一次 */
const dataCache = new Map<string, Promise<LottieData>>();

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

function loadAnimationData(name: string): Promise<LottieData> | null {
	const loader = animations[`../assets/lottie/${name}.json`];
	if (!loader) return null;
	let cached = dataCache.get(name);
	if (!cached) {
		cached = loader() as Promise<LottieData>;
		dataCache.set(name, cached);
	}
	return cached;
}

function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 自定义元素类必须定义在函数体内：模块被 Svelte 岛在服务端 import 时没有
 * HTMLElement，顶层 `class X extends HTMLElement` 会让 SSR 直接抛错。
 */
function defineElement(): void {
	class EmptyLottie extends HTMLElement {
		private player: LottiePlayer | null = null;
		private observer: IntersectionObserver | null = null;
		private initializing = false;
		private ready = false;

		connectedCallback() {
			if (this.initializing || this.ready) return;
			this.setAttribute("aria-hidden", "true");

			// 空态可能出现在首屏下方很远的地方，滚到再建，省一次 JSON 解析
			this.observer = new IntersectionObserver(
				(entries) => {
					if (!entries.some((entry) => entry.isIntersecting)) return;
					this.observer?.disconnect();
					this.observer = null;
					void this.init();
				},
				{ rootMargin: "200px" },
			);
			this.observer.observe(this);
		}

		disconnectedCallback() {
			this.observer?.disconnect();
			this.observer = null;
			// 元素被移除（换页、列表重渲染）时把实例销毁，否则 rAF 会一直跑
			this.player?.destroy();
			this.player = null;
			this.ready = false;
			this.initializing = false;
		}

		private async init(): Promise<void> {
			if (this.initializing) return;
			this.initializing = true;

			const name = this.dataset.animation || "utyan_empty";
			const data$ = loadAnimationData(name);
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

				this.player = lottie.loadAnimation({
					container: this,
					renderer: "svg",
					loop: true,
					autoplay: false,
					animationData: structuredClone(data),
					rendererSettings: {
						preserveAspectRatio: "xMidYMid meet",
						progressiveLoad: false,
					},
				});
				this.ready = true;
				this.dataset.ready = "true";

				if (prefersReducedMotion()) {
					// 静态一帧：不循环、不晃动
					this.player.goToAndStop(Math.floor((data.op ?? 2) / 2), true);
					return;
				}
				this.player.play();
				// 滚出视口就暂停，别让不可见的动画继续吃 CPU
				this.observer = new IntersectionObserver((entries) => {
					for (const entry of entries) {
						if (entry.isIntersecting) this.player?.play();
						else this.player?.pause();
					}
				});
				this.observer.observe(this);
			} catch {
				// 动画挂了不影响文案：留一个空占位，高度仍由 CSS 保证不塌
				this.initializing = false;
			}
		}
	}

	customElements.define("empty-lottie", EmptyLottie);
}

/**
 * 注册一次即可；重复调用无副作用。
 *
 * 守卫**不能**写成 `typeof window === "undefined"`：Svelte 5 编译服务端产物时会把
 * 这个表达式折成常量，于是整段守卫被当成死代码删掉，SSR 里接着读 `customElements`
 * 就是一个 ReferenceError（dev 日志里那串 `customElements is not defined`）。
 * `"customElements" in globalThis` 没有对应的折叠规则，服务端会老老实实返回。
 */
export function registerEmptyLottie(): void {
	if (!("customElements" in globalThis)) return;
	if (!customElements.get("empty-lottie")) defineElement();
}

/**
 * 给「没有模板可写」的地方（评论区的消息区是脚本拼的 DOM）现造一个实例。
 * 调用方负责 registerEmptyLottie()。
 */
export function createEmptyLottie(animation = "utyan_empty"): HTMLElement {
	const element = document.createElement("empty-lottie");
	element.dataset.animation = animation;
	return element;
}
