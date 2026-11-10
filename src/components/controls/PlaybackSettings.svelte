<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import {
	GLASS_BLUR_DEFAULT,
	GLASS_BLUR_MAX,
	GLASS_BLUR_MIN,
	GLASS_EVENT,
	type GlassEventDetail,
	readGlassBlur,
	saveGlassBlur,
} from "@/utils/now-playing-glass";
import {
	AUTOPLAY_DEFAULT,
	AUTOPLAY_EVENT,
	type AutoPlayEventDetail,
	readAutoPlay,
	saveAutoPlay,
} from "@/utils/now-playing-autoplay";
import {
	CARD_PERSIST_DEFAULT,
	CARD_PERSIST_EVENT,
	type CardPersistEventDetail,
	readCardPersistent,
	saveCardPersistent,
} from "@/utils/now-playing-persist";

/**
 * 播放设置面板：只放「偏好」——播放速度 / 音量 / 播放器玻璃 / 播放器常驻。
 * 曲目信息、播放控制、进度、播放模式、播放列表都在左下角的播放卡片里，这里不重复一遍。
 */

/** 面板里的速度档位：0.5× ~ 2×，每档 0.25 */
const SPEED_MIN = 50;
const SPEED_MAX = 200;
const SPEED_STEP = 25;

let panelEl: HTMLDivElement | undefined = $state();
let volume = $state(0.7);
let isMuted = $state(false);
let playbackRate = $state(1);
/** 播放条毛玻璃强度，0 = 关闭 */
let glassBlur = $state(GLASS_BLUR_DEFAULT);
/** 卡片是否常驻（暂停/停止后不收起） */
let persistent = $state(CARD_PERSIST_DEFAULT);
/** 进入站点是否自动播放（下次进站生效） */
let autoPlay = $state(AUTOPLAY_DEFAULT);

const volumePercent = $derived(Math.round(volume * 100));
const speedPercent = $derived(Math.round(playbackRate * 100));
const rateLabel = $derived(
	`${playbackRate.toFixed(2).replace(/\.?0+$/, "")}×`,
);

function syncFromManager(): void {
	const api = window.__fireflyMusic;
	if (!api) return;
	const state = api.getState();
	volume = state.volume ?? 0.7;
	isMuted = !!state.isMuted;
	playbackRate = state.playbackRate ?? 1;
}

function handleVolumeInput(event: Event): void {
	const input = event.currentTarget as HTMLInputElement;
	const next = Number(input.value) / 100;
	volume = next;
	window.__fireflyMusic?.setVolume?.(next);
}

function toggleMute(): void {
	window.__fireflyMusic?.toggleMute?.();
}

function handleRateInput(event: Event): void {
	const input = event.currentTarget as HTMLInputElement;
	const next = Number(input.value) / 100;
	playbackRate = next;
	window.__fireflyMusic?.setPlaybackRate?.(next);
}

function handleGlassInput(event: Event): void {
	const input = event.currentTarget as HTMLInputElement;
	glassBlur = saveGlassBlur(Number(input.value));
}

function togglePersistent(): void {
	persistent = saveCardPersistent(!persistent);
}

function toggleAutoPlay(): void {
	autoPlay = saveAutoPlay(!autoPlay);
}

function backToMenu(): void {
	window.__settingsOpenPanel?.("settings-menu");
}

onMount(() => {
	// 面板相对视口定位：挂到 <body> 下，避免被布局里的 transform / pointer-events 影响
	const anchor = document.createComment("playback-setting-anchor");
	if (panelEl && panelEl.parentNode !== document.body) {
		panelEl.parentNode?.insertBefore(anchor, panelEl);
		document.body.appendChild(panelEl);
	}

	syncFromManager();
	glassBlur = readGlassBlur();
	persistent = readCardPersistent();
	// 没存过时跟着 musicConfig.autoPlay 走，存过就以用户的选择为准
	autoPlay = readAutoPlay(
		window.__fireflyMusic?.getState?.().config?.autoPlay === true,
	);

	const handleGlass = (event: Event) => {
		const blur = (event as CustomEvent<GlassEventDetail>).detail?.blur;
		if (typeof blur === "number") glassBlur = blur;
	};

	const handlePersist = (event: Event) => {
		const next = (event as CustomEvent<CardPersistEventDetail>).detail
			?.persistent;
		if (typeof next === "boolean") persistent = next;
	};

	const handleAutoPlay = (event: Event) => {
		const next = (event as CustomEvent<AutoPlayEventDetail>).detail?.autoPlay;
		if (typeof next === "boolean") autoPlay = next;
	};

	const handleInit = () => syncFromManager();
	const handleVolume = (event: Event) => {
		const detail = (
			event as CustomEvent<{ volume?: number; isMuted?: boolean }>
		).detail;
		if (typeof detail?.volume === "number") volume = detail.volume;
		if (typeof detail?.isMuted === "boolean") isMuted = detail.isMuted;
	};
	const handleRate = (event: Event) => {
		const rate = (event as CustomEvent<{ playbackRate?: number }>).detail
			?.playbackRate;
		if (typeof rate === "number") playbackRate = rate;
	};

	window.addEventListener("fm:init", handleInit);
	window.addEventListener("fm:volume", handleVolume);
	window.addEventListener("fm:rate", handleRate);
	window.addEventListener(GLASS_EVENT, handleGlass);
	window.addEventListener(CARD_PERSIST_EVENT, handlePersist);
	window.addEventListener(AUTOPLAY_EVENT, handleAutoPlay);

	// 面板可能在别处改过状态（导航栏按钮、播放卡片），打开时重新对齐一次
	const observer = panelEl
		? new MutationObserver(() => {
				if (panelEl?.classList.contains("float-panel-closed")) return;
				syncFromManager();
			})
		: null;
	observer?.observe(panelEl as HTMLDivElement, {
		attributes: true,
		attributeFilter: ["class"],
	});

	return () => {
		window.removeEventListener("fm:init", handleInit);
		window.removeEventListener("fm:volume", handleVolume);
		window.removeEventListener("fm:rate", handleRate);
		window.removeEventListener(GLASS_EVENT, handleGlass);
		window.removeEventListener(CARD_PERSIST_EVENT, handlePersist);
		window.removeEventListener(AUTOPLAY_EVENT, handleAutoPlay);
		observer?.disconnect();
		if (panelEl && panelEl.parentNode === document.body) {
			if (anchor.parentNode) anchor.parentNode.insertBefore(panelEl, anchor);
			anchor.remove();
		}
	};
});
</script>

<div
	id="playback-setting"
	bind:this={panelEl}
	class="float-panel playback-panel float-panel-closed"
	data-floating-panel
	data-floating-panel-trigger="settings-floating"
	inert
	aria-hidden="true"
>
	<div class="panel-head">
		<button
			type="button"
			class="panel-back"
			aria-label={i18n(I18nKey.settings)}
			title={i18n(I18nKey.settings)}
			onclick={backToMenu}
		>
			<Icon icon="material-symbols:arrow-back-rounded" />
		</button>
		<span class="panel-title">{i18n(I18nKey.settingsPlayback)}</span>
	</div>

	<div class="panel-body">
		<div class="section-title">
			{i18n(I18nKey.playerSpeed)}
			<span class="section-hint">{rateLabel}</span>
		</div>
		<div class="volume-row">
			<Icon icon="material-symbols:speed-rounded" class="row-icon" />
			<input
				type="range"
				min={SPEED_MIN}
				max={SPEED_MAX}
				step={SPEED_STEP}
				value={speedPercent}
				style={`--range-progress:${((speedPercent - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100}%`}
				aria-label={i18n(I18nKey.playerSpeed)}
				oninput={handleRateInput}
			/>
			<span class="volume-value">{rateLabel}</span>
		</div>

		<div class="section-title">{i18n(I18nKey.musicVolume)}</div>
		<div class="volume-row">
			<button
				type="button"
				class="volume-mute"
				aria-label={i18n(I18nKey.musicVolume)}
				title={i18n(I18nKey.musicVolume)}
				onclick={toggleMute}
			>
				<Icon
					icon={isMuted || volume === 0
						? "material-symbols:volume-off-rounded"
						: "material-symbols:volume-up-rounded"}
				/>
			</button>
			<input
				type="range"
				min="0"
				max="100"
				step="1"
				value={volumePercent}
				style={`--range-progress:${isMuted ? 0 : volumePercent}%`}
				aria-label={i18n(I18nKey.musicVolume)}
				oninput={handleVolumeInput}
			/>
			<span class="volume-value">{isMuted ? "0" : volumePercent}%</span>
		</div>

		<div class="section-title">
			{i18n(I18nKey.playerGlass)}
			<span class="section-hint">{glassBlur}px</span>
		</div>
		<div class="volume-row">
			<Icon icon="material-symbols:contrast" class="row-icon" />
			<input
				type="range"
				min={GLASS_BLUR_MIN}
				max={GLASS_BLUR_MAX}
				step="1"
				value={glassBlur}
				style={`--range-progress:${
					((glassBlur - GLASS_BLUR_MIN) /
						(GLASS_BLUR_MAX - GLASS_BLUR_MIN)) *
					100
				}%`}
				aria-label={i18n(I18nKey.playerGlass)}
				oninput={handleGlassInput}
			/>
		</div>

		<div class="section-title">{i18n(I18nKey.playerPersistent)}</div>
		<div class="switch-row">
			<span class="switch-text">{i18n(I18nKey.playerPersistentHint)}</span>
			<button
				type="button"
				class="switch"
				role="switch"
				aria-checked={persistent}
				aria-label={i18n(I18nKey.playerPersistent)}
				onclick={togglePersistent}
			>
				<span class="switch-thumb" aria-hidden="true"></span>
			</button>
		</div>

		<div class="section-title">{i18n(I18nKey.playerAutoPlay)}</div>
		<div class="switch-row">
			<span class="switch-text">{i18n(I18nKey.playerAutoPlayHint)}</span>
			<button
				type="button"
				class="switch"
				role="switch"
				aria-checked={autoPlay}
				aria-label={i18n(I18nKey.playerAutoPlay)}
				onclick={toggleAutoPlay}
			>
				<span class="switch-thumb" aria-hidden="true"></span>
			</button>
		</div>
	</div>
</div>

<style>
	#playback-setting {
		position: fixed;
		right: 1rem;
		bottom: 5.25rem;
		left: auto;
		top: auto;
		z-index: 1100;
		width: 20rem;
		max-width: calc(100vw - 2rem);
		max-height: min(80vh, 42rem);
		display: flex;
		flex-direction: column;
		pointer-events: auto;
	}

	.panel-head {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
		padding: 0.625rem 0.75rem 0.375rem;
	}

	.panel-back {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 999px;
		font-size: 1.1rem;
		color: inherit;
		opacity: 0.65;
		transition:
			background-color 0.18s var(--ease-standard),
			color 0.18s var(--ease-standard),
			opacity 0.18s var(--ease-standard);
	}

	.panel-back:hover {
		background-color: var(--btn-plain-bg-hover);
		color: var(--primary);
		opacity: 1;
	}

	.panel-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: oklch(0.2 0.02 var(--hue));
	}

	:global(.dark) .panel-title {
		color: oklch(0.96 0.02 var(--hue));
	}

	/* 内容超出面板高度时自己滚动，标题栏固定 */
	.panel-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0 0.75rem 0.875rem;
	}

	.section-hint {
		margin-left: auto;
		font-size: 0.6875rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		color: inherit;
		opacity: 0.55;
	}

	.volume-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.volume-row input[type="range"] {
		flex: 1;
		min-width: 0;
	}

	.row-icon {
		flex-shrink: 0;
		width: 1.75rem;
		font-size: 1.15rem;
		color: inherit;
		opacity: 0.7;
	}

	.volume-mute {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 999px;
		font-size: 1.15rem;
		color: inherit;
		opacity: 0.7;
		transition:
			background-color 0.18s var(--ease-standard),
			color 0.18s var(--ease-standard),
			opacity 0.18s var(--ease-standard);
	}

	.volume-mute:hover {
		background-color: var(--btn-plain-bg-hover);
		color: var(--primary);
		opacity: 1;
	}

	.volume-value {
		flex-shrink: 0;
		width: 2.5rem;
		text-align: right;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		color: inherit;
		opacity: 0.7;
	}

	/* ── 开关行（播放器常驻） ─────────────────────────────── */
	.switch-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.125rem 0 0.25rem;
	}

	.switch-text {
		flex: 1;
		min-width: 0;
		font-size: 0.6875rem;
		line-height: 1.4;
		color: inherit;
		opacity: 0.6;
	}

	.switch {
		position: relative;
		flex: none;
		width: 2.25rem;
		height: 1.25rem;
		border-radius: 999px;
		background-color: var(--btn-regular-bg);
		transition: background-color 0.2s var(--ease-standard);
	}

	.switch[aria-checked="true"] {
		background-color: color-mix(in oklch, var(--primary) 72%, transparent);
	}

	.switch:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	.switch-thumb {
		position: absolute;
		top: 0.1875rem;
		left: 0.1875rem;
		width: 0.875rem;
		height: 0.875rem;
		border-radius: 50%;
		background-color: #fff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.22);
		transition: transform 0.2s var(--ease-standard);
	}

	.switch[aria-checked="true"] .switch-thumb {
		transform: translateX(1rem);
	}

	@media (prefers-reduced-motion: reduce) {
		.switch,
		.switch-thumb {
			transition: none;
		}
	}
</style>
