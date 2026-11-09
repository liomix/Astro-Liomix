<script lang="ts">
import sunMoonData from "@/assets/lottie/sun-moon.json";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import {
	DARK_MODE,
	LIGHT_MODE,
	SCHEDULED_MODE,
	SYSTEM_MODE,
} from "@/constants/constants";
import type { LIGHT_DARK_MODE } from "@/types/config.ts";
import {
	getStoredTheme,
	resolveTheme,
	setTheme,
} from "@/utils/setting-utils";
import { originFromElement } from "@/utils/light-dark-switch";

// 导航栏图标：一枚「月亮 ⇄ 太阳」的 Lottie，点一下就切换日/夜。
// 更细的模式（跟随系统、定时）在主题弹窗的「背景」里设置。
//
// 动画 36 帧 / 60fps（0.6s）：前 13 帧月亮收回，14~21 帧太阳旋转淡入。
// 日间停在第 0 帧（月），夜间停在最后一帧（日）—— 图标表示的是「点它会去到哪」，
// 所以白天看到的是月亮，晚上看到的是太阳。
//
// 末帧边界：Lottie 只在 [ip, op) 内绘制图层（这份 JSON 是 ip=0 / op=36），
// 36 本身已经落在区间外，所有图层都不满足条件，跳过去就是整块空白。
// 可绘制的最后一帧是 op - 1 = 35，也正好是正放结束时 advanceTime 停的位置。
const FRAME_MOON = sunMoonData.ip; // 0
const FRAME_SUN = sunMoonData.op - 1; // 35

// 存储的模式（可能是 system / scheduled）
let mode = $state<LIGHT_DARK_MODE>(LIGHT_MODE);
// 实际生效的模式，决定停在月帧还是日帧
let displayedMode = $state<LIGHT_DARK_MODE>(LIGHT_MODE);

let host = $state<HTMLDivElement>();
// Lottie 起来之前先显示静态图标占位，避免导航栏短暂缺一块
let lottieReady = $state(false);

/** 只用到 AnimationItem 的这几个方法，避免把 lottie 的类型拉进 SSR 图 */
interface LottiePlayer {
	goToAndStop: (value: number, isFrame?: boolean) => void;
	play: () => void;
	setDirection: (direction: number) => void;
	addEventListener: (event: "complete", handler: () => void) => void;
	destroy: () => void;
}

let player: LottiePlayer | null = null;

function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 当前明暗对应的停帧 */
function frameFor(target: LIGHT_DARK_MODE): number {
	return target === DARK_MODE ? FRAME_SUN : FRAME_MOON;
}

/** 把图标对齐到当前明暗；animate=false 时直接跳帧 */
function syncIcon(animate: boolean) {
	if (!player) return;
	const isDark = displayedMode === DARK_MODE;
	const target = frameFor(displayedMode);

	if (!animate || prefersReducedMotion()) {
		player.goToAndStop(target, true);
		return;
	}

	// 动画本身是「月 → 日」，切暗正放、切亮倒放
	player.setDirection(isDark ? 1 : -1);
	player.play();
}

function updateDisplayedMode(animate: boolean) {
	displayedMode = resolveTheme(mode);
	syncIcon(animate);
}

function toggleScheme(event: MouseEvent) {
	// 跟随系统/定时属于「自动」状态，点击后直接锁定到当前的对立面
	const nextMode = displayedMode === DARK_MODE ? LIGHT_MODE : DARK_MODE;
	mode = nextMode;
	displayedMode = nextMode;
	// 图标立刻开始变形，和背景的圆形扩散同时发生
	syncIcon(true);
	// 圆形揭示的圆心取按钮中心（键盘触发的点击坐标是 0，用矩形更稳）
	setTheme(nextMode, originFromElement(event.currentTarget as Element));
}

onMount(() => {
	mode = getStoredTheme();
	displayedMode = resolveTheme(mode);

	let disposed = false;

	// lottie-web 只在客户端加载；JSON 本身很小，静态引入即可
	void (async () => {
		const { default: lottie } = await import("lottie-web");
		if (disposed || !host) return;

		player = lottie.loadAnimation({
			container: host,
			renderer: "svg",
			loop: false,
			autoplay: false,
			animationData: structuredClone(sunMoonData),
			rendererSettings: {
				preserveAspectRatio: "xMidYMid meet",
				progressiveLoad: false,
			},
		}) as unknown as LottiePlayer;

		// 播放收尾后显式对齐一次目标帧：正常情况正放停在 35、倒放停在 0，
		// 已是可绘制帧；这一步是兜底，防止素材的 op 不是整数、或浏览器
		// 把末帧算到 op 上时停在整块空白的帧上。
		player.addEventListener("complete", () => {
			player?.goToAndStop(frameFor(displayedMode), true);
		});

		// 先确认能把图标画到目标帧，再撤掉静态占位 —— 万一 lottie 这一步失败，
		// 至少还留着一枚月亮/太阳，而不是一个空按钮。
		try {
			syncIcon(false);
		} catch {
			player?.destroy();
			player = null;
			return;
		}
		lottieReady = true;
	})();

	// 其他入口（主题弹窗、定时、跟随系统）改了主题时同步图标
	const handleThemeChange = () => {
		const previous = displayedMode;
		mode = getStoredTheme();
		const next = resolveTheme(mode);
		// 明暗没变（只是换了 system/scheduled）就不要重播一遍
		if (next === previous) return;
		displayedMode = next;
		syncIcon(true);
	};
	window.addEventListener("theme-change", handleThemeChange);

	// system / scheduled 模式下，实际生效的主题会自己变，图标要跟着变
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
	const handleSystemChange = () => {
		if (mode === SYSTEM_MODE || mode === SCHEDULED_MODE) {
			updateDisplayedMode(true);
		}
	};
	mediaQuery.addEventListener("change", handleSystemChange);

	return () => {
		disposed = true;
		window.removeEventListener("theme-change", handleThemeChange);
		mediaQuery.removeEventListener("change", handleSystemChange);
		player?.destroy();
		player = null;
	};
});
</script>

<button
	aria-label={`${i18n(I18nKey.lightMode)} / ${i18n(I18nKey.darkMode)}`}
	class="relative nav-icon-btn"
	id="scheme-switch"
	onclick={toggleScheme}
>
	<div class="sun-moon-host" bind:this={host} aria-hidden="true"></div>
	{#if !lottieReady}
		<div class="sun-moon-fallback" aria-hidden="true">
			<Icon
				icon={displayedMode === DARK_MODE
					? "material-symbols:wb-sunny-outline-rounded"
					: "material-symbols:dark-mode-outline-rounded"}
				class="text-[1.25rem]"
			></Icon>
		</div>
	{/if}
</button>

<style>
	.sun-moon-host {
		position: absolute;
		inset: 0.6rem;
		pointer-events: none;
	}

	.sun-moon-host :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}

	/*
	 * Lottie 里的颜色是写死的纯白（Android 深色设置页用的素材），
	 * 这里用 CSS 覆盖 SVG 的 presentation attribute —— 样式表优先级高于
	 * 表现属性，所以不会被动画帧改回去；图标于是自动跟随 .nav-icon-btn 的
	 * color（含 hover 变色与过渡）。
	 * 描边图层由 Lottie 写成 fill="none"，用 :not 排除掉，避免被填成实心。
	 */
	.sun-moon-host :global(svg [fill]:not([fill="none"])) {
		fill: currentColor !important;
	}

	.sun-moon-host :global(svg [stroke]) {
		stroke: currentColor !important;
	}

	.sun-moon-fallback {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
</style>
