<script lang="ts">
/**
 * 导航栏音乐入口（搜索图标右侧）：一枚「喇叭 + 飞出音符」的 Lottie 动画。
 * 点击只切播放/暂停，播放本身交给 window.__fireflyMusic；
 * 播放中循环播放，暂停时停回起始帧（圆 + 声波，音符还没飞出）。
 * 不设 title —— 悬浮时不要浏览器原生提示，语义只留在 aria-label。
 */
import speakersData from "@/assets/lottie/music-speakers.json";
import Icon from "@/components/common/Icon.svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import { onMount } from "svelte";

const labelPlay = i18n(I18nKey.musicPlay);
const labelPause = i18n(I18nKey.musicPause);

/** 静止帧：第 0 帧有圆底和声波，音符透明度还是 0，正好当「暂停」的静态图 */
const FRAME_IDLE = speakersData.ip;
/** 关闭动效时用一帧带音符的中间帧表示「正在播放」，不做动画 */
const FRAME_ACTIVE = 30;

/** 只声明用到的几个方法，避免把 lottie 的类型拉进 SSR 图 */
interface LottiePlayer {
	play: () => void;
	goToAndStop: (value: number, isFrame?: boolean) => void;
	destroy: () => void;
}

let host = $state<HTMLDivElement>();
/** Lottie 起来之前先用静态音符占位，避免导航栏短暂缺一块 */
let lottieReady = $state(false);
let isPlaying = $state(false);
let player: LottiePlayer | null = null;

function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 播放状态 → 动画播/停；关闭动效时用固定帧区分两种状态 */
function syncAnimation(): void {
	if (!player) return;
	if (prefersReducedMotion()) {
		player.goToAndStop(isPlaying ? FRAME_ACTIVE : FRAME_IDLE, true);
		return;
	}
	if (isPlaying) {
		player.play();
		return;
	}
	player.goToAndStop(FRAME_IDLE, true);
}

async function togglePlayback(): Promise<void> {
	const api = window.__fireflyMusic;
	if (!api) return;
	// 侧栏播放器被关掉（sidebarConfig 里 music 那条 enable:false）时没人触发过 init，
	// 歌单还是空的 —— 这里补一次初始化，再切播放
	if (!api.getState().initialized) await api.init();
	if (!api.getState().initialized) return;
	api.togglePlay();
}

onMount(() => {
	let disposed = false;

	// lottie-web 只在客户端加载；JSON 只有 30KB 左右，静态引入即可
	void (async () => {
		const { default: lottie } = await import("lottie-web");
		if (disposed || !host) return;

		player = lottie.loadAnimation({
			container: host,
			renderer: "svg",
			loop: true,
			autoplay: false,
			animationData: structuredClone(speakersData),
			rendererSettings: {
				preserveAspectRatio: "xMidYMid meet",
				progressiveLoad: false,
			},
		}) as unknown as LottiePlayer;

		// 画得出第一帧才撤掉静态占位；万一失败，按钮至少还有一枚音符
		try {
			syncAnimation();
		} catch {
			player?.destroy();
			player = null;
			return;
		}
		lottieReady = true;
	})();

	const syncFromManager = (): void => {
		const state = window.__fireflyMusic?.getState();
		if (!state) return;
		isPlaying = !!state.isPlaying;
		syncAnimation();
	};
	const handlePlayState = (event: Event): void => {
		isPlaying = !!(
			event as CustomEvent<{ isPlaying?: boolean }>
		).detail?.isPlaying;
		syncAnimation();
	};

	// 管理器可能已经先跑完（两个脚本执行顺序不固定），这里补一次同步
	syncFromManager();
	window.addEventListener("fm:init", syncFromManager);
	window.addEventListener("fm:play-state", handlePlayState);

	return () => {
		disposed = true;
		window.removeEventListener("fm:init", syncFromManager);
		window.removeEventListener("fm:play-state", handlePlayState);
		player?.destroy();
		player = null;
	};
});
</script>

<button
	type="button"
	id="nav-music-switch"
	class="nav-icon-btn nav-music-btn"
	class:is-playing={isPlaying}
	aria-label={isPlaying ? labelPause : labelPlay}
	aria-pressed={isPlaying ? "true" : "false"}
	onclick={togglePlayback}
>
	<div class="nav-music-host" bind:this={host} aria-hidden="true"></div>
	{#if !lottieReady}
		<span class="nav-music-fallback" aria-hidden="true">
			<Icon icon="material-symbols:music-note-rounded" class="text-[1.4rem]" />
		</span>
	{/if}
</button>

<style>
	/*
	 * 素材画布 400×400，但去掉圆底后内容只占中间约 112×200（宽 28%），
	 * 直接按按钮尺寸铺会小得看不清。容器放大到 5rem 居中后，
	 * 喇叭本体约 22px（和原来 1.4rem 的音符图标一致），音符飞出也不会被裁。
	 */
	.nav-music-host {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 5rem;
		height: 5rem;
		transform: translate(-50%, -50%);
		pointer-events: none;
	}

	.nav-music-host :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}

	.nav-music-fallback {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
</style>
