<script lang="ts">
/**
 * 导航栏站点图标：一枚「破壳」Lottie 动画（src/assets/lottie/ya_newborn.json）。
 * 进页面播一次，定格在孵出的小鸡上；鼠标移进品牌区（图标或标题）再重播一次。
 * 素材 512×512、3 秒，由 siteConfig.navbar.logo 的 lottie 类型指定名字。
 */
import { onMount } from "svelte";

interface Props {
	/** src/assets/lottie 下的文件名（不含扩展名） */
	name?: string;
}

let { name = "ya_newborn" }: Props = $props();

/** 素材按名字动态加载：导航栏每个页面都要用，做成独立 chunk 由客户端按需取 */
const animations = import.meta.glob<unknown>("../../assets/lottie/*.json", {
	import: "default",
});

interface LottiePlayer {
	play: () => void;
	goToAndStop: (value: number, isFrame?: boolean) => void;
	destroy: () => void;
}

let host = $state<HTMLDivElement>();
/** 第一帧画出来之前保持透明，避免先闪一下空白方框 */
let ready = $state(false);
let player: LottiePlayer | null = null;

function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

onMount(() => {
	let disposed = false;
	/** 悬停重播的监听挂在品牌区上，卸载时要摘掉（不能只在 async 里返回） */
	let trigger: Element | null = null;
	let replay: (() => void) | null = null;

	const url = `../../assets/lottie/${name}.json`;
	const load = animations[url];
	if (!load) return;

	void (async () => {
		const [{ default: lottie }, data] = await Promise.all([
			import("lottie-web"),
			load(),
		]);
		if (disposed || !host) return;

		const animation = data as { op?: number };
		const lastFrame = Math.max(0, (animation.op ?? 1) - 1);
		const reduced = prefersReducedMotion();

		player = (
			lottie as unknown as {
				loadAnimation: (config: Record<string, unknown>) => LottiePlayer;
			}
		).loadAnimation({
			container: host,
			renderer: "svg",
			loop: false,
			// 关掉动效时直接给最终帧（孵出来的样子），不做动画
			autoplay: !reduced,
			animationData: structuredClone(data as object),
			rendererSettings: {
				preserveAspectRatio: "xMidYMid meet",
				progressiveLoad: false,
			},
		});

		if (reduced) player.goToAndStop(lastFrame, true);
		ready = true;

		// 悬停重播：挂在整块品牌区上，鼠标落在标题文字上也照样触发
		trigger = host.closest(".navbar-brand") ?? host;
		replay = (): void => {
			if (!host || prefersReducedMotion() || !player) return;
			player.goToAndStop(0, true);
			player.play();
		};
		trigger.addEventListener("pointerenter", replay);
	})();

	return () => {
		disposed = true;
		if (trigger && replay) trigger.removeEventListener("pointerenter", replay);
		trigger = null;
		replay = null;
		player?.destroy();
		player = null;
	};
});
</script>

<span
	class="nav-lottie-logo"
	class:is-ready={ready}
	bind:this={host}
	aria-hidden="true"
></span>

<style>
	/*
	 * 素材画布 512×512，Telegram 贴纸本身是紧贴内容裁切的，所以按方框等比铺满即可。
	 * 大小用变量收口，导航栏里想调就直接改 --nav-lottie-size。
	 */
	.nav-lottie-logo {
		display: block;
		flex: none;
		width: var(--nav-lottie-size, 2.5rem);
		height: var(--nav-lottie-size, 2.5rem);
		opacity: 0;
		transition: opacity 0.25s var(--ease-standard, ease);
	}

	.nav-lottie-logo.is-ready {
		opacity: 1;
	}

	.nav-lottie-logo :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
