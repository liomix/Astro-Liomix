<script lang="ts">
/**
 * 打赏金币的动画层（素材 src/assets/lottie/coin.json）。
 * 只负责画：欧 / 美 / 日三种硬币各 1.76s 轮播，整体 5.28s 一循环。
 * 点击、弹窗、无障碍语义都在外层 SponsorButton.astro 的 <button> 上，
 * 所以这里整体 pointer-events: none + aria-hidden。
 */
import coinData from "@/assets/lottie/coin.json";
import { onMount } from "svelte";

/** 静止帧：第 110 帧是日元硬币刚翻到正面，正好当「不播动效」的静态图 */
const FRAME_IDLE = 110;

/** 只声明用到的几个方法，避免把 lottie 的类型拉进 SSR 图 */
interface LottiePlayer {
	play: () => void;
	goToAndStop: (value: number, isFrame?: boolean) => void;
	destroy: () => void;
}

let host = $state<HTMLDivElement>();
/** Lottie 起来之前先显示静态金币占位，避免按钮里空一块 */
let ready = $state(false);
let player: LottiePlayer | null = null;

function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

onMount(() => {
	let disposed = false;

	// lottie-web 只在客户端加载；JSON 38KB 左右，静态引入即可
	void (async () => {
		const { default: lottie } = await import("lottie-web");
		if (disposed || !host) return;

		player = lottie.loadAnimation({
			container: host,
			renderer: "svg",
			loop: true,
			autoplay: false,
			animationData: structuredClone(coinData),
			rendererSettings: {
				preserveAspectRatio: "xMidYMid meet",
				progressiveLoad: false,
			},
		}) as unknown as LottiePlayer;

		// 关掉动效时固定在一帧正面金币上；画不出就退回静态占位
		try {
			if (prefersReducedMotion()) {
				player.goToAndStop(FRAME_IDLE, true);
			} else {
				player.play();
			}
		} catch {
			player?.destroy();
			player = null;
			return;
		}
		ready = true;
	})();

	return () => {
		disposed = true;
		player?.destroy();
		player = null;
	};
});
</script>

<div class="sponsor-button-lottie" bind:this={host} aria-hidden="true"></div>
{#if !ready}
	<span class="sponsor-button-fallback" aria-hidden="true">¥</span>
{/if}

<style>
	/*
	 * 素材画布 400×400，金币直径 158（39%），sparkle 最外圈约 250。
	 * 容器按 6rem 铺、居中溢出按钮（溢出部分是透明的），硬币约 38px，
	 * 与旧版 3rem CSS 金币的视觉重量接近，也留得下周围的小星星。
	 */
	.sponsor-button-lottie {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 6rem;
		height: 6rem;
		transform: translate(-50%, -50%);
		pointer-events: none;
	}

	.sponsor-button-lottie :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}

	/* 与旧版 CSS 金币一致：金底 + 底部径向高光 + 内阴影 */
	.sponsor-button-fallback {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background-color: #d4af37;
		background-image: radial-gradient(
			circle at 50% 120%,
			rgb(255 255 255 / 0.5) 0%,
			rgb(255 255 255 / 0) 80%
		);
		box-shadow: inset 0 0 2.5px rgb(0 0 0 / 0.3);
		font-size: 1.35rem;
		font-weight: 700;
		line-height: 1;
		color: rgb(0 0 0 / 0.5);
		text-shadow: 1px 1px 1px rgb(255 255 255 / 0.5);
	}

	:global(.sponsor-button:hover) .sponsor-button-lottie,
	:global(.sponsor-button:hover) .sponsor-button-fallback {
		filter: brightness(1.07);
	}
</style>
