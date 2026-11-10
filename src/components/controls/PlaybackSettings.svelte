<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";

type PlayMode = 0 | 1 | 2;
type Track = { name?: string; artist?: string; pic?: string };

const modes: { value: PlayMode; icon: string; label: string }[] = [
	{
		value: 0,
		icon: "material-symbols:repeat-rounded",
		label: i18n(I18nKey.playModeList),
	},
	{
		value: 1,
		icon: "material-symbols:repeat-one-rounded",
		label: i18n(I18nKey.playModeOne),
	},
	{
		value: 2,
		icon: "material-symbols:shuffle-rounded",
		label: i18n(I18nKey.playModeRandom),
	},
];

/** 面板里的速度档位：0.5× ~ 2×，每档 0.25 */
const SPEED_MIN = 50;
const SPEED_MAX = 200;
const SPEED_STEP = 25;

let panelEl: HTMLDivElement | undefined = $state();
let playMode: PlayMode = $state(0);
let volume = $state(0.7);
let isMuted = $state(false);
let playbackRate = $state(1);

let track: Track | null = $state(null);
let playlist: Track[] = $state([]);
let currentIndex = $state(0);
let isPlaying = $state(false);

let progress = $state(0);
let currentTimeStr = $state("0:00");
let durationStr = $state("0:00");
let duration = $state(0);

// 拖动进度条时先显示预览位置，松手才真正 seek
let scrubbing = $state(false);
let scrubPercent = $state(0);

const volumePercent = $derived(Math.round(volume * 100));
const speedPercent = $derived(Math.round(playbackRate * 100));
const shownPercent = $derived(scrubbing ? scrubPercent : progress);
const shownTime = $derived(
	scrubbing && duration > 0
		? formatTime((scrubPercent / 100) * duration)
		: currentTimeStr,
);
const hasTrack = $derived(!!track || playlist.length > 0);
const rateLabel = $derived(
	`${playbackRate.toFixed(2).replace(/\.?0+$/, "")}×`,
);

function formatTime(seconds: number): string {
	if (!seconds || Number.isNaN(seconds)) return "0:00";
	const min = Math.floor(seconds / 60);
	const sec = Math.floor(seconds % 60);
	return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}

function syncFromManager(): void {
	const api = window.__fireflyMusic;
	if (!api) return;
	const state = api.getState();
	playMode = (state.playMode ?? 0) as PlayMode;
	volume = state.volume ?? 0.7;
	isMuted = !!state.isMuted;
	playbackRate = state.playbackRate ?? 1;
	track = state.track ?? null;
	playlist = state.playlist ?? [];
	currentIndex = state.currentIndex ?? 0;
	isPlaying = !!state.isPlaying;
	progress = state.progress ?? 0;
	currentTimeStr = state.currentTimeStr ?? "0:00";
	durationStr = state.durationStr ?? "0:00";
	duration = state.duration ?? 0;
}

/** 面板可能在播放器初始化前就打开了，用到时补一次初始化 */
function ensureReady(): Promise<void> | void {
	const api = window.__fireflyMusic;
	if (!api) return;
	if (!api.getState().initialized) {
		return api.init().then(syncFromManager);
	}
	return undefined;
}

async function withManager(action: () => void): Promise<void> {
	const ready = ensureReady();
	if (ready) await ready;
	action();
}

function togglePlay(): void {
	void withManager(() => window.__fireflyMusic?.togglePlay());
}

function playPrev(): void {
	void withManager(() => window.__fireflyMusic?.playPrev());
}

function playNext(): void {
	void withManager(() => window.__fireflyMusic?.playNext());
}

function selectMode(mode: PlayMode): void {
	playMode = mode;
	window.__fireflyMusic?.setPlayMode?.(mode);
}

function handleProgressInput(event: Event): void {
	const input = event.currentTarget as HTMLInputElement;
	scrubbing = true;
	scrubPercent = Number(input.value) / 10;
}

function commitSeek(): void {
	if (!scrubbing) return;
	const percent = scrubPercent;
	scrubbing = false;
	void withManager(() => window.__fireflyMusic?.seek?.(percent / 100));
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

function selectTrack(index: number): void {
	if (index === currentIndex) {
		if (!isPlaying) togglePlay();
		return;
	}
	void withManager(() => window.__fireflyMusic?.playTrackByIndex?.(index));
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

	const handleInit = () => syncFromManager();
	const handleTrack = (event: Event) => {
		const detail = (
			event as CustomEvent<{ track?: Track; index?: number }>
		).detail;
		if (detail?.track) track = detail.track;
		if (typeof detail?.index === "number") currentIndex = detail.index;
	};
	const handlePlayState = (event: Event) => {
		isPlaying = !!(event as CustomEvent<{ isPlaying?: boolean }>).detail
			?.isPlaying;
	};
	const handleTime = (event: Event) => {
		const detail = (
			event as CustomEvent<{
				progress?: number;
				currentTimeStr?: string;
				durationStr?: string;
				duration?: number;
			}>
		).detail;
		if (typeof detail?.progress === "number") progress = detail.progress;
		if (detail?.currentTimeStr) currentTimeStr = detail.currentTimeStr;
		if (detail?.durationStr) durationStr = detail.durationStr;
		if (typeof detail?.duration === "number") duration = detail.duration;
	};
	const handleMode = (event: Event) => {
		playMode = ((event as CustomEvent<{ playMode?: number }>).detail
			?.playMode ?? 0) as PlayMode;
	};
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
	window.addEventListener("fm:track", handleTrack);
	window.addEventListener("fm:play-state", handlePlayState);
	window.addEventListener("fm:time", handleTime);
	window.addEventListener("fm:mode", handleMode);
	window.addEventListener("fm:volume", handleVolume);
	window.addEventListener("fm:rate", handleRate);

	// 打开面板时才拉歌单（local 无网络开销，meting 模式也不会白请求接口）
	const observer = panelEl
		? new MutationObserver(() => {
				if (panelEl?.classList.contains("float-panel-closed")) return;
				syncFromManager();
				void ensureReady();
			})
		: null;
	observer?.observe(panelEl as HTMLDivElement, {
		attributes: true,
		attributeFilter: ["class"],
	});

	return () => {
		window.removeEventListener("fm:init", handleInit);
		window.removeEventListener("fm:track", handleTrack);
		window.removeEventListener("fm:play-state", handlePlayState);
		window.removeEventListener("fm:time", handleTime);
		window.removeEventListener("fm:mode", handleMode);
		window.removeEventListener("fm:volume", handleVolume);
		window.removeEventListener("fm:rate", handleRate);
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
		<!-- 正在播放 + 播放控制 + 进度 -->
		<div class="now-playing">
			<div class="np-cover">
				{#if track?.pic}
					<img src={track.pic} alt={track.name ?? ""} loading="lazy" />
				{:else}
					<Icon icon="material-symbols:music-note-rounded" />
				{/if}
			</div>
			<div class="np-meta">
				<span class="np-title" title={track?.name ?? ""}>
					{track?.name ?? i18n(I18nKey.musicNoPlaying)}
				</span>
				<span class="np-artist">{track?.artist ?? ""}</span>
			</div>
		</div>

		<div class="transport">
			<button
				type="button"
				class="transport-btn"
				aria-label={i18n(I18nKey.musicPrev)}
				title={i18n(I18nKey.musicPrev)}
				disabled={!hasTrack}
				onclick={playPrev}
			>
				<Icon icon="material-symbols:skip-previous-rounded" />
			</button>
			<button
				type="button"
				class="transport-btn is-primary"
				aria-label={isPlaying ? i18n(I18nKey.musicPause) : i18n(I18nKey.musicPlay)}
				title={isPlaying ? i18n(I18nKey.musicPause) : i18n(I18nKey.musicPlay)}
				aria-pressed={isPlaying}
				disabled={!hasTrack}
				onclick={togglePlay}
			>
				<Icon
					icon={isPlaying
						? "material-symbols:pause-rounded"
						: "material-symbols:play-arrow-rounded"}
				/>
			</button>
			<button
				type="button"
				class="transport-btn"
				aria-label={i18n(I18nKey.musicNext)}
				title={i18n(I18nKey.musicNext)}
				disabled={!hasTrack}
				onclick={playNext}
			>
				<Icon icon="material-symbols:skip-next-rounded" />
			</button>
		</div>

		<div class="progress-row">
			<span class="time">{shownTime}</span>
			<input
				type="range"
				min="0"
				max="1000"
				step="1"
				value={Math.round(shownPercent * 10)}
				style={`--range-progress:${shownPercent}%`}
				aria-label={i18n(I18nKey.musicProgress)}
				oninput={handleProgressInput}
				onchange={commitSeek}
				disabled={!duration}
			/>
			<span class="time">{durationStr}</span>
		</div>

		<div class="section-title">{i18n(I18nKey.playMode)}</div>
		<div class="mode-group">
			{#each modes as mode (mode.value)}
				<button
					type="button"
					class="mode-btn"
					class:is-active={playMode === mode.value}
					aria-pressed={playMode === mode.value}
					onclick={() => selectMode(mode.value)}
				>
					<Icon icon={mode.icon} class="mode-icon" />
					<span class="mode-label">{mode.label}</span>
				</button>
			{/each}
		</div>

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

		{#if playlist.length > 0}
			<div class="section-title">
				{i18n(I18nKey.playerPlaylist)}
				<span class="section-hint">{playlist.length}</span>
			</div>
			<ul class="playlist">
				{#each playlist as item, index (index)}
					<li>
						<button
							type="button"
							class="pl-item"
							class:is-active={index === currentIndex}
							aria-current={index === currentIndex ? "true" : undefined}
							onclick={() => selectTrack(index)}
						>
							<span class="pl-index">
								{#if index === currentIndex && isPlaying}
									<Icon icon="material-symbols:music-note-rounded" />
								{:else}
									{index + 1}
								{/if}
							</span>
							<span class="pl-name">{item.name ?? ""}</span>
							<span class="pl-artist">{item.artist ?? ""}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
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

	/* ── 正在播放 ── */
	.now-playing {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem;
		border-radius: 0.75rem;
		background-color: var(--btn-regular-bg);
	}

	.np-cover {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 2.75rem;
		height: 2.75rem;
		overflow: hidden;
		border-radius: 0.625rem;
		font-size: 1.25rem;
		color: var(--primary);
		background-color: color-mix(in oklch, var(--primary) 12%, transparent);
	}

	.np-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.np-meta {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.np-title {
		font-size: 0.8125rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: oklch(0.2 0.02 var(--hue));
	}

	:global(.dark) .np-title {
		color: oklch(0.96 0.02 var(--hue));
	}

	.np-artist {
		font-size: 0.6875rem;
		color: inherit;
		opacity: 0.65;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ── 播放控制 ── */
	.transport {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.625rem;
		margin: 0.625rem 0 0.5rem;
	}

	.transport-btn {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 999px;
		font-size: 1.5rem;
		color: inherit;
		opacity: 0.85;
		background-color: var(--btn-regular-bg);
		transition:
			background-color 0.18s var(--ease-standard),
			color 0.18s var(--ease-standard),
			opacity 0.18s var(--ease-standard),
			transform 0.18s var(--ease-standard);
	}

	.transport-btn:hover:not(:disabled) {
		background-color: var(--btn-regular-bg-hover);
		color: var(--primary);
		opacity: 1;
	}

	.transport-btn:active:not(:disabled) {
		transform: scale(0.92);
	}

	.transport-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.transport-btn.is-primary {
		width: 2.75rem;
		height: 2.75rem;
		font-size: 1.75rem;
		color: #fff;
		opacity: 1;
		background-color: var(--primary);
		box-shadow: 0 6px 14px -8px color-mix(in oklch, var(--primary) 80%, transparent);
	}

	.transport-btn.is-primary:hover:not(:disabled) {
		color: #fff;
		filter: brightness(1.06);
	}

	/* ── 进度 ── */
	.progress-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.progress-row input[type="range"] {
		flex: 1;
		min-width: 0;
	}

	.time {
		flex-shrink: 0;
		font-size: 0.6875rem;
		font-variant-numeric: tabular-nums;
		color: inherit;
		opacity: 0.6;
	}

	.section-hint {
		margin-left: auto;
		font-size: 0.6875rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		color: inherit;
		opacity: 0.55;
	}

	.mode-group {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.375rem;
	}

	.mode-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 0.5rem 0.25rem;
		border-radius: 0.75rem;
		font-size: 0.6875rem;
		color: inherit;
		opacity: 0.75;
		background-color: var(--btn-regular-bg);
		transition:
			background-color 0.18s var(--ease-standard),
			color 0.18s var(--ease-standard);
	}

	.mode-btn:hover {
		background-color: var(--btn-regular-bg-hover);
		color: var(--primary);
		opacity: 1;
	}

	.mode-btn.is-active {
		color: var(--primary);
		opacity: 1;
		background-color: color-mix(in oklch, var(--primary) 14%, transparent);
	}

	.mode-icon {
		font-size: 1.15rem;
	}

	.mode-label {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
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

	/* ── 播放列表 ── */
	.playlist {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		max-height: 11rem;
		overflow-y: auto;
		overscroll-behavior: contain;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.pl-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.375rem 0.5rem;
		border-radius: 0.5rem;
		font-size: 0.75rem;
		text-align: left;
		color: inherit;
		opacity: 0.8;
		transition:
			background-color 0.15s var(--ease-standard),
			color 0.15s var(--ease-standard),
			opacity 0.15s var(--ease-standard);
	}

	.pl-item:hover {
		background-color: var(--btn-regular-bg-hover);
		opacity: 1;
	}

	.pl-item.is-active {
		color: var(--primary);
		opacity: 1;
		background-color: color-mix(in oklch, var(--primary) 12%, transparent);
	}

	.pl-index {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.125rem;
		font-size: 0.6875rem;
		font-variant-numeric: tabular-nums;
		opacity: 0.65;
	}

	.pl-item.is-active .pl-index {
		font-size: 0.875rem;
		opacity: 1;
	}

	.pl-name {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pl-artist {
		flex-shrink: 0;
		max-width: 6rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.6875rem;
		opacity: 0.6;
	}

	@media (prefers-reduced-motion: reduce) {
		.transport-btn,
		.mode-btn,
		.pl-item {
			transition: none;
		}
	}
</style>
