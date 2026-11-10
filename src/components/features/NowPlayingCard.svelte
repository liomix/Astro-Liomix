<script lang="ts">
/**
 * 左下角迷你播放条
 * 版式：贴左下角的横条——左侧圆形封面（盖播放键），右侧三行（曲名/歌手 + 控制、
 * 当前歌词、进度条/时间/音量/歌词开关/播放模式），最右侧收起箭头。
 * 数据全部来自 MusicManager 派发的 fm:* 事件，本组件不碰 audio 元素。
 */
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import {
	GLASS_BLUR_DEFAULT,
	GLASS_EVENT,
	type GlassEventDetail,
	readGlassBlur,
} from "@/utils/now-playing-glass";
import { readLyricsOpen, saveLyricsOpen } from "@/utils/now-playing-lyrics";
import {
	CARD_PERSIST_DEFAULT,
	CARD_PERSIST_EVENT,
	type CardPersistEventDetail,
	readCardPersistent,
} from "@/utils/now-playing-persist";

type Track = { name?: string; artist?: string; pic?: string; url?: string };
type LyricLine = { time: number; text: string };
type LyricStatus = "none" | "loading" | "loaded" | "failed";

const labelPlay = i18n(I18nKey.musicPlay);
const labelPause = i18n(I18nKey.musicPause);
const labelPrev = i18n(I18nKey.musicPrev);
const labelNext = i18n(I18nKey.musicNext);
const labelProgress = i18n(I18nKey.musicProgress);
const labelPlaylist = i18n(I18nKey.musicPlaylist);
const labelNoSongs = i18n(I18nKey.musicNoSongs);
const labelVolume = i18n(I18nKey.musicVolume);
const labelLyrics = i18n(I18nKey.musicLyrics);
const labelNoLyric = i18n(I18nKey.musicNoLyrics);
const labelLoadingLyric = i18n(I18nKey.musicLoadingLyrics);
const labelTapForSound = i18n(I18nKey.playerTapForSound);
const labelCollapse = i18n(I18nKey.collapse);
const labelExpand = i18n(I18nKey.more);
const fallbackTitle = i18n(I18nKey.music);

/** 播放模式：0 列表循环 / 1 单曲循环 / 2 随机，与 MusicManager 的 state.playMode 对齐 */
const modeIcons = [
	"material-symbols:repeat-rounded",
	"material-symbols:repeat-one-rounded",
	"material-symbols:shuffle-rounded",
];
const modeLabels = [
	i18n(I18nKey.playModeList),
	i18n(I18nKey.playModeOne),
	i18n(I18nKey.playModeRandom),
];

let track: Track | null = $state(null);
let playlist: Track[] = $state([]);
let currentIndex = $state(0);
let isPlaying = $state(false);
let playMode = $state(0);
let coverOk = $state(true);
let progress = $state(0);
let currentTimeStr = $state("0:00");
let durationStr = $state("0:00");
let listOpen = $state(false);
/** 关列表 → 折叠之间的延时（等列表滑回，约等于它的 0.28s 过渡） */
let collapseTimer: ReturnType<typeof setTimeout> | undefined;
let resizeTimer: ReturnType<typeof setTimeout> | undefined;
let collapsed = $state(false);
/** 宽度动画进行中：期间撤掉背景模糊，避免模糊快照滞后于卡片本体 */
let resizing = $state(false);
let isMuted = $state(false);
let volume = $state(0.7);
/** 毛玻璃强度（px），0 = 关闭，播放设置里可调 */
let glassBlur = $state(GLASS_BLUR_DEFAULT);
/** 卡片是否常驻（暂停/停止后不收起），播放设置里可调 */
let persistent = $state(CARD_PERSIST_DEFAULT);
/** 播放过至少一次才浮出卡片，避免一进站就挂着一张空卡 */
let hasTrack = $state(false);
/** 进站自动播放被浏览器拦截 → 静音起播中，等首次交互开声音 */
let autoplayMuted = $state(false);

/** 歌词：Manager 解析好的时间轴，卡片只显示「当前这一句」 */
let lyrics: LyricLine[] = $state([]);
let lrcIndex = $state(-1);
let lyricStatus: LyricStatus = $state("none");
/** 歌词行是否展开（按钮在音量右侧，默认展开） */
let lyricsOpen = $state(readLyricsOpen());

/** 竖向音量条：拖动中由指针捕获维持展开 */
let volumeTrack: HTMLDivElement | undefined = $state();
let volumeDragging = $state(false);

/** 拖动进度条时先显示预览位置，松手才真正 seek */
let seekEl: HTMLDivElement | undefined = $state();
let dragging = $state(false);
let previewPercent = $state(0);

/** 曲名跑马灯：只在文字比容器宽时才滚动 */
let titleBox: HTMLDivElement | undefined = $state();
let titleText: HTMLSpanElement | undefined = $state();
let marquee = $state(false);
let marqueeShift = $state(0);
let marqueeDur = $state(10);

// 常驻：播过之后一直浮在左下角；非常驻：只在播放中（或列表打开时）出现
const visible = $derived(hasTrack && (persistent || isPlaying || listOpen));
const coverSrc = $derived(coverOk && track?.pic ? track.pic : "");
const shownPercent = $derived(dragging ? previewPercent : progress);
const volumePercent = $derived(Math.round((isMuted ? 0 : volume) * 100));
const modeIcon = $derived(modeIcons[playMode] ?? modeIcons[0]);
const modeLabel = $derived(modeLabels[playMode] ?? modeLabels[0]);
// 曲名与歌手合成一行，和参考版式一致：「歌名 - 歌手」
const displayTitle = $derived(
	track?.artist ? `${track.name || fallbackTitle} - ${track.artist}` : track?.name || fallbackTitle,
);
// 当前歌词：LRC 的间奏行常常是空串，向上找回最近一句，别让歌词行闪成空白
const lyricText = $derived.by(() => {
	// 静音自动播放（浏览器拦截带声音的自动播放时的兜底）优先提示怎么出声
	if (autoplayMuted) return labelTapForSound;
	if (lyricStatus === "loading" && lyrics.length === 0) return labelLoadingLyric;
	if (lyrics.length === 0) return labelNoLyric;
	for (let i = Math.max(0, lrcIndex); i >= 0; i--) {
		const text = (lyrics[i]?.text ?? "").trim();
		if (text) return text;
	}
	return labelNoLyric;
});

function toggleLyrics(): void {
	lyricsOpen = saveLyricsOpen(!lyricsOpen);
}

function syncFromManager(): void {
	const api = window.__fireflyMusic;
	if (!api) return;
	const state = api.getState();
	track = state.track ?? null;
	playlist = state.playlist ?? [];
	currentIndex = state.currentIndex ?? 0;
	isPlaying = !!state.isPlaying;
	// 有当前曲目就说明播放器已经启动过，常驻模式下可以直接浮出
	if (state.track) hasTrack = true;
	playMode = state.playMode ?? 0;
	isMuted = !!state.isMuted;
	volume = state.volume ?? 0.7;
	progress = state.progress ?? 0;
	currentTimeStr = state.currentTimeStr ?? "0:00";
	durationStr = state.durationStr ?? "0:00";
	lyrics = state.lyrics ?? [];
	lrcIndex = state.currentLrcIndex ?? -1;
	if (lyrics.length > 0) lyricStatus = "loaded";
}

/** 播放器可能还没初始化（侧栏 widget 关掉了），控制时补一次 */
async function withManager(action: () => void): Promise<void> {
	const api = window.__fireflyMusic;
	if (!api) return;
	if (!api.getState().initialized) await api.init();
	action();
}

function toggle(): void {
	void withManager(() => window.__fireflyMusic?.togglePlay());
}

function playPrev(): void {
	void withManager(() => window.__fireflyMusic?.playPrev());
}

function playNext(): void {
	void withManager(() => window.__fireflyMusic?.playNext());
}

function cycleMode(): void {
	void withManager(() => window.__fireflyMusic?.cyclePlayMode());
}

function toggleMute(): void {
	void withManager(() => window.__fireflyMusic?.toggleMute());
}

/** 竖向音量条：底部 0%、顶部 100% */
function volumeFromPointer(event: PointerEvent): number {
	if (!volumeTrack) return volume;
	const rect = volumeTrack.getBoundingClientRect();
	if (rect.height === 0) return volume;
	return Math.min(1, Math.max(0, (rect.bottom - event.clientY) / rect.height));
}

function applyVolume(next: number): void {
	volume = next;
	window.__fireflyMusic?.setVolume?.(next);
}

function onVolumePointerDown(event: PointerEvent): void {
	event.preventDefault();
	volumeDragging = true;
	(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	applyVolume(volumeFromPointer(event));
}

function onVolumePointerMove(event: PointerEvent): void {
	if (!volumeDragging) return;
	applyVolume(volumeFromPointer(event));
}

function onVolumePointerUp(event: PointerEvent): void {
	if (!volumeDragging) return;
	volumeDragging = false;
	const el = event.currentTarget as HTMLElement;
	if (el.hasPointerCapture(event.pointerId)) {
		el.releasePointerCapture(event.pointerId);
	}
}

function onVolumeKeydown(event: KeyboardEvent): void {
	const step = 0.05;
	let next = volume;
	if (event.key === "ArrowUp" || event.key === "ArrowRight") next += step;
	else if (event.key === "ArrowDown" || event.key === "ArrowLeft") next -= step;
	else if (event.key === "Home") next = 0;
	else if (event.key === "End") next = 1;
	else return;
	event.preventDefault();
	applyVolume(Math.min(1, Math.max(0, Number(next.toFixed(2)))));
}

function selectTrack(index: number): void {
	void withManager(() => window.__fireflyMusic?.playTrackByIndex(index));
}

function toggleList(): void {
	listOpen = !listOpen;
}

/** 宽度动画期间临时关掉背景模糊并冻结跑马灯测量，动画结束后恢复 */
function beginResize(): void {
	clearTimeout(resizeTimer);
	resizing = true;
	resizeTimer = setTimeout(() => {
		resizing = false;
		// 此时宽度已落定，补测一次跑马灯（动画期间被跳过了）
		measureTitle();
	}, 340);
}

function toggleCollapse(): void {
	clearTimeout(collapseTimer);
	if (collapsed) {
		collapsed = false;
		beginResize();
		return;
	}
	// 播放列表还开着：先让它滑回去，收窄在中途就接上，避免两段动画串行拖沓
	if (listOpen) {
		listOpen = false;
		collapseTimer = setTimeout(() => {
			collapsed = true;
			beginResize();
		}, 200);
		return;
	}
	collapsed = true;
	beginResize();
}

function measureTitle(): void {
	const box = titleBox;
	const text = titleText;
	if (!box || !text) return;
	// 宽度动画期间每帧都会触发 ResizeObserver：读 scrollWidth/clientWidth
	// 会强制同步布局，正是收起展开卡顿的来源，等动画结束再量
	if (resizing) return;
	const width = text.scrollWidth;
	const overflow = width > box.clientWidth + 2;
	marquee = overflow;
	marqueeShift = overflow ? width + 20 : 0;
	// 速度跟文字长度走：每 30px 约 1s，过快会看不清
	marqueeDur = Math.max(8, Math.round(width / 30));
}

function percentFromPointer(event: PointerEvent): number {
	if (!seekEl) return 0;
	const rect = seekEl.getBoundingClientRect();
	if (!rect.width) return 0;
	const ratio = (event.clientX - rect.left) / rect.width;
	return Math.min(1, Math.max(0, ratio)) * 100;
}

function onSeekPointerDown(event: PointerEvent): void {
	if (event.button !== 0 || !seekEl) return;
	dragging = true;
	previewPercent = percentFromPointer(event);
	try {
		seekEl.setPointerCapture(event.pointerId);
	} catch {
		/* 指针已释放时忽略 */
	}
}

function onSeekPointerMove(event: PointerEvent): void {
	if (!dragging) return;
	previewPercent = percentFromPointer(event);
}

function onSeekPointerUp(event: PointerEvent): void {
	if (!dragging) return;
	const percent = percentFromPointer(event);
	dragging = false;
	if (seekEl) {
		try {
			seekEl.releasePointerCapture(event.pointerId);
		} catch {
			/* 指针已释放时忽略 */
		}
	}
	void withManager(() => window.__fireflyMusic?.seek?.(percent / 100));
}

function onSeekKeydown(event: KeyboardEvent): void {
	const step = 5;
	let next: number | null = null;
	if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
		next = progress - step;
	} else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
		next = progress + step;
	} else if (event.key === "Home") {
		next = 0;
	} else if (event.key === "End") {
		next = 100;
	}
	if (next === null) return;
	event.preventDefault();
	const clamped = Math.min(100, Math.max(0, next));
	void withManager(() => window.__fireflyMusic?.seek?.(clamped / 100));
}

onMount(() => {
	syncFromManager();
	glassBlur = readGlassBlur();
	persistent = readCardPersistent();

	const handleGlass = (event: Event): void => {
		const blur = (event as CustomEvent<GlassEventDetail>).detail?.blur;
		if (typeof blur === "number") glassBlur = blur;
	};
	const handlePersist = (event: Event): void => {
		const next = (event as CustomEvent<CardPersistEventDetail>).detail
			?.persistent;
		if (typeof next === "boolean") persistent = next;
	};
	window.addEventListener(GLASS_EVENT, handleGlass);
	window.addEventListener(CARD_PERSIST_EVENT, handlePersist);

	const handleInit = (event: Event): void => {
		const detail = (
			event as CustomEvent<{ playlist?: Track[]; playMode?: number }>
		).detail;
		if (detail?.playlist) playlist = detail.playlist;
		if (typeof detail?.playMode === "number") playMode = detail.playMode;
		syncFromManager();
	};
	const handlePlayState = (event: Event): void => {
		isPlaying = !!(
			event as CustomEvent<{ isPlaying?: boolean }>
		).detail?.isPlaying;
		if (isPlaying) hasTrack = true;
		// 停止播放时顺手收起播放列表，避免「没在播却挂着列表」
		if (!isPlaying) {
			clearTimeout(collapseTimer);
			clearTimeout(resizeTimer);
			resizing = false;
			dragging = false;
			listOpen = false;
			// 没在播了，「点击页面开启声音」这条提示也就没意义了
			autoplayMuted = false;
		}
	};
	const handleTrack = (event: Event): void => {
		const detail = (
			event as CustomEvent<{ track?: Track; index?: number }>
		).detail;
		if (typeof detail?.index === "number") currentIndex = detail.index;
		if (detail?.track) {
			track = detail.track;
			hasTrack = true;
			coverOk = true;
		}
	};
	const handleMode = (event: Event): void => {
		const next = (event as CustomEvent<{ playMode?: number }>).detail?.playMode;
		if (typeof next === "number") playMode = next;
	};
	const handleVolume = (event: Event): void => {
		const detail = (
			event as CustomEvent<{ volume?: number; isMuted?: boolean }>
		).detail;
		if (typeof detail?.volume === "number") volume = detail.volume;
		if (typeof detail?.isMuted === "boolean") isMuted = detail.isMuted;
		// 声音已经打开（用户点了页面 / 自己取消了静音）→ 收掉提示
		if (detail?.isMuted === false) autoplayMuted = false;
	};
	// 浏览器拦截了带声音的进站自动播放，管理器改用静音起播
	const handleAutoplayMuted = (event: Event): void => {
		autoplayMuted = !!(event as CustomEvent<{ muted?: boolean }>).detail?.muted;
	};
	// 换曲：Manager 已重置时间轴，这里跟着清空并等新歌的歌词
	const handleLyrics = (event: Event): void => {
		const detail = (
			event as CustomEvent<{ lyrics?: LyricLine[]; status?: LyricStatus }>
		).detail;
		lyrics = Array.isArray(detail?.lyrics) ? detail.lyrics : [];
		lyricStatus = detail?.status ?? (lyrics.length > 0 ? "loaded" : "none");
		lrcIndex = -1;
	};
	const handleLrcIndex = (event: Event): void => {
		const index = (event as CustomEvent<{ index?: number }>).detail?.index;
		if (typeof index === "number") lrcIndex = index;
	};
	const handleTime = (event: Event): void => {
		const detail = (
			event as CustomEvent<{
				progress?: number;
				currentTimeStr?: string;
				durationStr?: string;
			}>
		).detail;
		// 拖动时不让 timeupdate 把预览位置顶掉
		if (!dragging && typeof detail?.progress === "number") {
			progress = detail.progress;
		}
		if (!dragging && detail?.currentTimeStr) {
			currentTimeStr = detail.currentTimeStr;
		}
		if (detail?.durationStr) durationStr = detail.durationStr;
	};
	const handleKeydown = (event: KeyboardEvent): void => {
		if (event.key === "Escape" && listOpen) listOpen = false;
	};

	window.addEventListener("fm:init", handleInit);
	window.addEventListener("fm:play-state", handlePlayState);
	window.addEventListener("fm:track", handleTrack);
	window.addEventListener("fm:mode", handleMode);
	window.addEventListener("fm:volume", handleVolume);
	window.addEventListener("fm:autoplay-muted", handleAutoplayMuted);
	window.addEventListener("fm:time", handleTime);
	window.addEventListener("fm:lyrics", handleLyrics);
	window.addEventListener("fm:lrc-index", handleLrcIndex);
	window.addEventListener("keydown", handleKeydown);

	// 容器宽度变化（窗口缩放 / 展开收起）后重新判断要不要滚动
	const observer = titleBox ? new ResizeObserver(measureTitle) : null;
	if (titleBox) observer?.observe(titleBox);

	return () => {
		window.removeEventListener("fm:init", handleInit);
		window.removeEventListener("fm:play-state", handlePlayState);
		window.removeEventListener("fm:track", handleTrack);
		window.removeEventListener("fm:mode", handleMode);
		window.removeEventListener("fm:volume", handleVolume);
		window.removeEventListener("fm:autoplay-muted", handleAutoplayMuted);
		window.removeEventListener("fm:time", handleTime);
		window.removeEventListener("fm:lyrics", handleLyrics);
		window.removeEventListener("fm:lrc-index", handleLrcIndex);
		window.removeEventListener("keydown", handleKeydown);
		window.removeEventListener(GLASS_EVENT, handleGlass);
		window.removeEventListener(CARD_PERSIST_EVENT, handlePersist);
		clearTimeout(collapseTimer);
		clearTimeout(resizeTimer);
		observer?.disconnect();
	};
});

// 换曲后重新测一次跑马灯宽度（曲名作为依赖，DOM 更新完再量）
$effect(() => {
	const name = displayTitle;
	if (!titleBox && name === undefined) return;
	measureTitle();
});
</script>

<aside
	class="now-playing"
	class:is-open={visible}
	class:is-mini={collapsed}
	class:has-glass={glassBlur > 0}
	class:has-lyric={lyricsOpen}
	class:has-list={listOpen}
	class:is-resizing={resizing}
	style:--np-blur={`${glassBlur}px`}
	aria-label={fallbackTitle}
	aria-hidden={!visible}
	inert={!visible}
>
	<!-- 玻璃底色：把封面放大加糊铺满，做出参考图那种「取自封面的暖色玻璃」 -->
	{#if glassBlur > 0 && coverSrc}
		<span class="np-tint-clip">
			<img class="np-tint" src={coverSrc} alt="" />
		</span>
	{/if}
	<!-- 播放列表：播放条上沿向上展开，无标题栏（用 ≡ 按钮开关） -->
	<div class="np-list" class:is-open={listOpen} inert={!listOpen}>
		<div class="np-list-body custom-scrollbar">
			{#if playlist.length === 0}
				<p class="np-list-empty">{labelNoSongs}</p>
			{:else}
				<ol class="np-list-items">
					{#each playlist as item, index (index)}
						<li>
							<button
								type="button"
								class="np-item"
								class:is-active={index === currentIndex}
								aria-current={index === currentIndex ? "true" : undefined}
								onclick={() => selectTrack(index)}
							>
								<span class="np-item-index">{index + 1}</span>
								<span class="np-item-name">{item.name || fallbackTitle}</span>
								<span class="np-item-artist">{item.artist || ""}</span>
							</button>
						</li>
					{/each}
				</ol>
			{/if}
		</div>
	</div>

	<div class="np-row">
		<!-- 封面：圆形唱片，播放时匀速旋转；整块是播放/暂停按钮 -->
		<button
			type="button"
			class="np-cover"
			aria-label={isPlaying ? labelPause : labelPlay}
			title={isPlaying ? labelPause : labelPlay}
			onclick={toggle}
		>
			<span class="np-disc" class:is-spinning={isPlaying}>
				{#if coverSrc}
					<img src={coverSrc} alt="" onerror={() => (coverOk = false)} />
				{:else}
					<Icon
						icon="material-symbols:music-note-rounded"
						class="np-cover-icon"
					/>
				{/if}
			</span>
			<span class="np-cover-btn" aria-hidden="true">
				<Icon
					icon={isPlaying
						? "material-symbols:pause-rounded"
						: "material-symbols:play-arrow-rounded"}
				/>
			</span>
		</button>

		<div class="np-main">
			<div class="np-line">
				<div class="np-title-box" class:is-clipped={marquee} bind:this={titleBox}>
					<div
						class="np-marquee"
						class:is-scrolling={marquee}
						style={`--np-marquee-shift:${marqueeShift}px;--np-marquee-dur:${marqueeDur}s`}
					>
						<span class="np-title" bind:this={titleText}>{displayTitle}</span>
						{#if marquee}
							<span class="np-title" aria-hidden="true">{displayTitle}</span>
						{/if}
					</div>
				</div>

				<div class="np-actions">
					<button
						type="button"
						class="np-btn"
						aria-label={labelPrev}
						title={labelPrev}
						onclick={playPrev}
					>
						<Icon icon="material-symbols:skip-previous-rounded" />
					</button>
					<button
						type="button"
						class="np-btn np-btn-play"
						aria-label={isPlaying ? labelPause : labelPlay}
						title={isPlaying ? labelPause : labelPlay}
						onclick={toggle}
					>
						<Icon
							icon={isPlaying
								? "material-symbols:pause-rounded"
								: "material-symbols:play-arrow-rounded"}
						/>
					</button>
					<button
						type="button"
						class="np-btn"
						aria-label={labelNext}
						title={labelNext}
						onclick={playNext}
					>
						<Icon icon="material-symbols:skip-next-rounded" />
					</button>
					<button
						type="button"
						class="np-btn"
						class:is-on={listOpen}
						aria-label={labelPlaylist}
						aria-expanded={listOpen}
						title={labelPlaylist}
						onclick={toggleList}
					>
						<Icon icon="material-symbols:playlist-play-rounded" />
					</button>
				</div>
			</div>

			<!-- 歌词行：只放当前这一句，换句时从下往上淡入（{#key} 重建节点） -->
			<div class="np-lyric" aria-hidden={!lyricsOpen}>
				{#key lyricText}
					<span class="np-lyric-text" class:is-hint={autoplayMuted}
						>{lyricText}</span
					>
				{/key}
			</div>

			<div class="np-line">
				<div
					bind:this={seekEl}
					class="np-bar"
					class:is-dragging={dragging}
					role="slider"
					tabindex="0"
					aria-label={labelProgress}
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={Math.round(shownPercent)}
					aria-valuetext={`${currentTimeStr} / ${durationStr}`}
					onpointerdown={onSeekPointerDown}
					onpointermove={onSeekPointerMove}
					onpointerup={onSeekPointerUp}
					onpointercancel={onSeekPointerUp}
					onkeydown={onSeekKeydown}
				>
					<div class="np-bar-track">
						<div class="np-bar-fill" style={`width:${shownPercent}%`}></div>
						<span class="np-bar-thumb" style={`left:${shownPercent}%`}></span>
					</div>
				</div>

				<span class="np-time">{currentTimeStr} / {durationStr}</span>

				<!-- 音量：静音开关 + 悬浮/拖动时从按钮上方浮出的竖向音量条 -->
				<div class="np-volume" class:is-adjusting={volumeDragging}>
					<div class="np-volume-pop" class:is-open={volumeDragging}>
						<div
							bind:this={volumeTrack}
							class="np-volume-track"
							role="slider"
							tabindex="0"
							aria-label={labelVolume}
							aria-valuemin="0"
							aria-valuemax="100"
							aria-valuenow={volumePercent}
							onpointerdown={onVolumePointerDown}
							onpointermove={onVolumePointerMove}
							onpointerup={onVolumePointerUp}
							onpointercancel={onVolumePointerUp}
							onkeydown={onVolumeKeydown}
						>
							<div
								class="np-volume-fill"
								class:is-muted={isMuted || volume === 0}
								style={`height:${volumePercent}%`}
							>
							</div>
							<span
								class="np-volume-knob"
								style={`bottom:${volumePercent}%`}
							></span>
						</div>
					</div>
					<button
						type="button"
						class="np-btn np-btn-quiet"
						data-np-mute
						aria-label={labelVolume}
						title={labelVolume}
						onclick={toggleMute}
					>
						<Icon
							icon={isMuted
								? "material-symbols:volume-off-rounded"
								: "material-symbols:volume-up-rounded"}
						/>
					</button>
				</div>

				<!-- 歌词开关：紧跟音量，切换后卡片高度随之增减 -->
				<button
					type="button"
					class="np-btn np-btn-quiet"
					class:is-on={lyricsOpen}
					aria-label={labelLyrics}
					aria-pressed={lyricsOpen}
					title={labelLyrics}
					onclick={toggleLyrics}
				>
					<Icon icon="material-symbols:lyrics" />
				</button>

				<button
					type="button"
					class="np-btn np-btn-quiet"
					aria-label={modeLabel}
					title={modeLabel}
					onclick={cycleMode}
				>
					<Icon icon={modeIcon} />
				</button>
			</div>
		</div>

		<button
			type="button"
			class="np-collapse"
			aria-label={collapsed ? labelExpand : labelCollapse}
			title={collapsed ? labelExpand : labelCollapse}
			aria-expanded={!collapsed}
			onclick={toggleCollapse}
		>
			<span class="np-collapse-chevron" class:is-flipped={collapsed}>
				<Icon icon="fa7-solid:chevron-right" />
			</span>
		</button>
	</div>
</aside>

<style>
	/* 紧贴左下角：无外边距、只留右上圆角，向上长出播放列表 */
	.now-playing {
		/* 宽度用一条尾段更平缓的曲线：起步快、收尾软，比标准 ease 更跟手 */
		--np-ease: cubic-bezier(0.32, 0.72, 0, 1);
		/* 歌词行占的额外高度：关掉歌词、收起卡片时归零，卡片回落原尺寸 */
		--np-lyric-h: 0rem;
		position: fixed;
		left: 0;
		bottom: 0;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		width: min(22rem, 100vw);
		/* 背景 / 圆角 / 模糊只画在根元素这一个盒子上：
		   内部层不再各自上色，展开收起时就不会出现多层轮廓错位 */
		background-color: var(--card-bg);
		border-top: 1px solid rgba(0, 0, 0, 0.06);
		border-right: 1px solid rgba(0, 0, 0, 0.06);
		border-top-right-radius: var(--radius-large);
		box-shadow: 0 2px 14px rgba(0, 0, 0, 0.07);
		opacity: 0;
		transform: translateY(0.75rem);
		transform-origin: 0 100%;
		pointer-events: none;
		transition:
			opacity 0.26s var(--ease-standard),
			transform 0.26s var(--ease-standard),
			width 0.32s var(--np-ease);
	}

	.now-playing.is-open {
		opacity: 1;
		transform: none;
		pointer-events: auto;
	}

	/* ── 毛玻璃（强度来自播放设置，--np-blur 由组件的 style 指令写入） ── */
	.now-playing.has-glass {
		background-color: color-mix(in oklch, var(--card-bg) 72%, transparent);
		backdrop-filter: blur(var(--np-blur, 16px)) saturate(1.5);
		-webkit-backdrop-filter: blur(var(--np-blur, 16px)) saturate(1.5);
		box-shadow:
			0 2px 14px rgba(0, 0, 0, 0.07),
			inset 0 1px 0 rgba(255, 255, 255, 0.16);
	}

	/* 宽度动画期间撤掉背景模糊：backdrop-filter 不逐帧重算，
	   会拿旧快照去裁新尺寸，看起来比卡片本体慢半拍 */
	.now-playing.is-resizing {
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
	}

	/* 同期间跑马灯停住：位移动画和逐帧重排叠在一起最容易掉帧 */
	.now-playing.is-resizing .np-marquee {
		animation-play-state: paused;
	}

	/* 玻璃底色层：自己裁圆角，卡片本体不能再 overflow:hidden（否则音量条浮不出去） */
	.np-tint-clip {
		position: absolute;
		inset: 0;
		overflow: hidden;
		border-radius: inherit;
		pointer-events: none;
	}

	/* 封面色调层：放大 + 模糊铺满卡片，给玻璃一个取自封面的底色 */
	.np-tint {
		position: absolute;
		top: -30%;
		left: -6.6rem;
		/* 宽度写死（卡片最宽 22rem 的 160%）：宽度动画期间这张图不重排、
		   不重算模糊，只是被上面的 clip 裁一刀，省掉每帧的大面积重绘 */
		width: 35.2rem;
		height: 160%;
		object-fit: cover;
		filter: blur(calc(var(--np-blur, 16px) * 1.6)) saturate(1.45);
		opacity: 0.62;
		pointer-events: none;
		user-select: none;
	}

	/* 色调层之上再垫一层薄卡色，文字不直接压在封面色上，对比度更稳 */
	.np-tint-clip::after {
		content: "";
		position: absolute;
		inset: 0;
		background-color: color-mix(in oklch, var(--card-bg) 46%, transparent);
	}

	/* 收起后只剩封面 + 箭头（4.5rem + 1.25rem）；不留歌词位置，卡片回到方形 */
	.now-playing.is-mini {
		width: 5.75rem;
		--np-lyric-h: 0rem;
	}

	/* 歌词行展开时卡片向上多长一行 */
	.now-playing.has-lyric {
		--np-lyric-h: 1.0625rem;
	}

	/* 收起状态压过 has-lyric：两条规则同权重，靠这条更具体的选择器收尾 */
	.now-playing.is-mini.has-lyric {
		--np-lyric-h: 0rem;
	}

	/* 收起：内容随卡片变窄被自然压到 0，同时淡出（不是 display:none 瞬间消失） */
	.now-playing.is-mini .np-main {
		padding-right: 0;
		padding-left: 0;
		opacity: 0;
		pointer-events: none;
	}

	:global(.dark) .now-playing {
		border-top-color: rgba(255, 255, 255, 0.1);
		border-right-color: rgba(255, 255, 255, 0.1);
		box-shadow:
			0 2px 14px rgba(0, 0, 0, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.08);
	}

	/* ── 主行：封面 + 两行信息 + 收起箭头 ─────────────────── */
	.np-row {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: stretch;
		/* 高度 = 基础两行 + 歌词行（--np-lyric-h，关掉歌词时为 0）：
		   展开/收起时只有宽度变，卡片竖向纹丝不动 */
		height: calc(
			4.5rem + var(--np-lyric-h, 0rem) + env(safe-area-inset-bottom, 0px)
		);
		padding-bottom: env(safe-area-inset-bottom, 0px);
		transition: height 0.28s var(--np-ease);
	}

	.np-cover {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 4.5rem;
		color: var(--primary);
	}

	/* 圆形唱片：占满封面区（无内边距），播放时匀速旋转，暂停时停在当前角度 */
	.np-disc {
		display: grid;
		place-items: center;
		width: 4.5rem;
		height: 4.5rem;
		border-radius: 50%;
		overflow: hidden;
		background-color: color-mix(in oklch, var(--primary) 14%, transparent);
		box-shadow: inset 0 0 0 1px
			color-mix(in oklch, var(--primary) 14%, transparent);
		/* 用 play-state 而不是加/删动画，暂停后角度不丢 */
		animation: np-spin 18s linear infinite;
		animation-play-state: paused;
	}

	.np-disc.is-spinning {
		animation-play-state: running;
	}

	@keyframes np-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.np-disc img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.np-cover-icon {
		font-size: 1.35rem;
	}

	/* 圆形播放键：默认隐藏，悬浮（或键盘聚焦）时才浮出 */
	.np-cover-btn {
		position: absolute;
		top: 50%;
		left: 50%;
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		font-size: 1rem;
		color: #fff;
		background-color: rgba(0, 0, 0, 0.34);
		border: 1px solid rgba(255, 255, 255, 0.8);
		backdrop-filter: blur(2px);
		opacity: 0;
		transform: translate(-50%, -50%) scale(0.86);
		transition:
			opacity 0.18s var(--ease-standard),
			transform 0.18s var(--ease-standard),
			background-color 0.18s var(--ease-standard);
	}

	.np-cover:hover .np-cover-btn,
	.np-cover:focus-visible .np-cover-btn {
		opacity: 1;
		background-color: rgba(0, 0, 0, 0.46);
		transform: translate(-50%, -50%) scale(1);
	}

	/* 触屏没有 hover，常显否则完全看不到入口 */
	@media (hover: none) {
		.np-cover-btn {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
	}

	.np-main {
		display: flex;
		flex: 1;
		flex-direction: column;
		justify-content: center;
		/* 4.5rem 的固定高度里要装下两行，间距和内边距都得收紧 */
		gap: 0.1875rem;
		min-width: 0;
		/* 展开动画期间容器还在变宽，内容先被裁住，避免文字/按钮溢出卡片 */
		overflow: hidden;
		padding: 0.375rem 0.5rem 0.375rem 0.75rem;
		transition:
			opacity 0.24s var(--np-ease),
			padding 0.32s var(--np-ease);
	}

	.np-line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	/* ── 曲名（跑马灯） ───────────────────────────────────── */
	.np-title-box {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	/* 文字被裁掉时右侧淡出，提示还有内容 */
	.np-title-box.is-clipped {
		mask-image: linear-gradient(to right, #000 calc(100% - 1.25rem), transparent);
	}

	.np-marquee {
		display: inline-flex;
		gap: 1.25rem;
		white-space: nowrap;
	}

	.np-marquee.is-scrolling {
		animation: np-marquee var(--np-marquee-dur, 10s) linear infinite;
		animation-delay: 1s;
	}

	.np-marquee.is-scrolling:hover {
		animation-play-state: paused;
	}

	.np-title {
		font-size: 0.8125rem;
		font-weight: 500;
		line-height: 1.25rem;
		color: oklch(0.35 0.02 var(--hue));
	}

	:global(.dark) .np-title {
		color: oklch(0.92 0.02 var(--hue));
	}

	@keyframes np-marquee {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(calc(-1 * var(--np-marquee-shift, 0px)));
		}
	}

	/* ── 歌词行：一行当前句，随 fm:lrc-index 换行 ───────────── */
	.np-lyric {
		display: flex;
		align-items: center;
		flex: none;
		height: var(--np-lyric-h, 0rem);
		overflow: hidden;
		/* 高度跟着卡片一起收，文字同时淡出，不会先消失再收卡 */
		transition:
			height 0.28s var(--np-ease),
			opacity 0.2s var(--ease-standard);
	}

	.now-playing:not(.has-lyric) .np-lyric {
		opacity: 0;
	}

	.np-lyric-text {
		/* flex:1 让文字撑满一行，长句才会走出省略号而不是把容器顶开 */
		flex: 1;
		min-width: 0;
		overflow: hidden;
		font-size: 0.6875rem;
		line-height: 1.0625rem;
		color: oklch(0.5 0.02 var(--hue));
		white-space: nowrap;
		text-overflow: ellipsis;
		animation: np-lyric-in 0.3s var(--ease-standard);
	}

	:global(.dark) .np-lyric-text {
		color: oklch(0.74 0.02 var(--hue));
	}

	/* 静音自动播放的提示：用主题色 + 轻微呼吸，提示「点一下就有声音」 */
	.np-lyric-text.is-hint {
		color: var(--primary);
		animation:
			np-lyric-in 0.3s var(--ease-standard),
			np-hint-pulse 2.2s ease-in-out infinite;
	}

	@keyframes np-hint-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.np-lyric-text.is-hint {
			animation: none;
		}
	}

	@keyframes np-lyric-in {
		from {
			opacity: 0;
			transform: translateY(0.375rem);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	/* ── 控制按钮 ─────────────────────────────────────────── */
	.np-actions {
		display: flex;
		align-items: center;
		gap: 0.0625rem;
		flex: none;
	}

	.np-btn {
		display: grid;
		place-items: center;
		flex: none;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		font-size: 1.15rem;
		color: oklch(0.45 0.02 var(--hue));
		transition:
			background-color 0.18s var(--ease-standard),
			color 0.18s var(--ease-standard),
			transform 0.18s var(--ease-standard);
	}

	.np-btn:hover {
		color: var(--primary);
		background-color: var(--btn-plain-bg-hover);
	}

	.np-btn:active {
		transform: scale(0.92);
	}

	.np-btn-play {
		font-size: 1.35rem;
		color: var(--primary);
	}

	/* 非默认状态的模式按钮点亮主题色 */
	.np-btn.is-on {
		color: var(--primary);
	}

	.np-btn-quiet {
		width: 1.5rem;
		height: 1.5rem;
		font-size: 1.05rem;
		opacity: 0.75;
	}

	/* 开着的安静按钮（歌词行）亮起来，和关闭态区分 */
	.np-btn-quiet.is-on {
		opacity: 1;
	}

	/* ── 竖向音量条：悬浮 / 聚焦 / 拖动时从按钮上方浮出 ──────── */
	.np-volume {
		position: relative;
		display: flex;
		flex: none;
	}

	/* 贴住按钮上沿，中间不留缝：鼠标从按钮滑上去时 hover 不会中断（留缝会反复展开/收起抖动） */
	.np-volume-pop {
		position: absolute;
		left: 50%;
		bottom: 100%;
		z-index: 20;
		display: flex;
		justify-content: center;
		width: 1.75rem;
		height: 2.5rem;
		padding: 0.3125rem 0;
		border-radius: 999px;
		background-color: color-mix(in oklch, var(--card-bg) 94%, transparent);
		border: 1px solid var(--line-divider);
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16);
		/* 只做位移 + 淡入，不加 scale / backdrop-filter：两者叠在过渡上容易抖 */
		transform: translate(-50%, 0.25rem);
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		will-change: opacity, transform;
		transition:
			opacity 0.16s var(--ease-standard),
			transform 0.16s var(--ease-standard),
			visibility 0.16s;
	}

	.np-volume:hover .np-volume-pop,
	.np-volume:focus-within .np-volume-pop,
	.np-volume-pop.is-open {
		opacity: 1;
		visibility: visible;
		pointer-events: auto;
		transform: translate(-50%, 0);
	}

	.np-volume-track {
		position: relative;
		width: 0.375rem;
		height: 100%;
		border-radius: 999px;
		background-color: color-mix(in oklch, var(--primary) 20%, transparent);
		cursor: pointer;
		touch-action: none;
	}

	.np-volume-track:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	.np-volume-fill {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		border-radius: 999px;
		background-color: var(--primary);
		transition: height 0.08s linear;
	}

	/* 静音时把填充压暗，位置仍然跟着真实音量 */
	.np-volume-fill.is-muted {
		background-color: color-mix(in oklch, var(--primary) 40%, transparent);
	}

	/* 拖动中不做补间，避免手感发黏 */
	.np-volume-pop.is-open .np-volume-fill,
	.np-volume-pop.is-open .np-volume-knob {
		transition: none;
	}

	.np-volume-knob {
		position: absolute;
		left: 50%;
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 50%;
		background-color: var(--card-bg);
		box-shadow:
			0 0 0 2px var(--primary),
			0 1px 3px rgba(0, 0, 0, 0.25);
		transform: translate(-50%, 50%);
		pointer-events: none;
		transition: bottom 0.06s linear;
	}

	:global(.dark) .np-btn {
		color: oklch(0.78 0.02 var(--hue));
	}

	:global(.dark) .np-btn-play,
	:global(.dark) .np-btn.is-on {
		color: var(--primary);
	}

	/* ── 进度条：3px，悬停加粗并露出圆点 ─────────────────── */
	.np-bar {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		height: 0.875rem;
		cursor: pointer;
		touch-action: none;
		outline: none;
	}

	.np-bar-track {
		position: relative;
		width: 100%;
		height: 3px;
		border-radius: 999px;
		background-color: color-mix(in oklch, var(--primary) 16%, transparent);
		transition: height 0.18s var(--ease-standard);
	}

	.np-bar:hover .np-bar-track,
	.np-bar:focus-visible .np-bar-track,
	.np-bar.is-dragging .np-bar-track {
		height: 4px;
	}

	.np-bar-fill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		border-radius: 999px;
		background-color: var(--primary);
		transition: width 0.2s linear;
	}

	.np-bar.is-dragging .np-bar-fill {
		transition: none;
	}

	.np-bar-thumb {
		position: absolute;
		top: 50%;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background-color: var(--primary);
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 18%, transparent);
		transform: translate(-50%, -50%) scale(0);
		transition: transform 0.16s var(--ease-standard);
	}

	.np-bar:hover .np-bar-thumb,
	.np-bar:focus-visible .np-bar-thumb,
	.np-bar.is-dragging .np-bar-thumb {
		transform: translate(-50%, -50%) scale(1);
	}

	.np-time {
		flex: none;
		font-size: 0.625rem;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: oklch(0.5 0.02 var(--hue));
	}

	:global(.dark) .np-time {
		color: oklch(0.72 0.02 var(--hue));
	}

	/* ── 收起/展开箭头（贴右边缘的窄条） ─────────────────── */
	.np-collapse {
		display: grid;
		place-items: center;
		flex: none;
		width: 1.25rem;
		border-left: 1px solid var(--line-divider);
		/* 自带背景是直角矩形，得自己跟着卡片右上角圆，否则会把圆角盖掉 */
		border-top-right-radius: var(--radius-large);
		font-size: 0.875rem;
		color: oklch(0.5 0.02 var(--hue));
		background-color: var(--btn-plain-bg-hover);
		transition:
			color 0.18s var(--ease-standard),
			background-color 0.18s var(--ease-standard);
	}

	/* 列表展开时它在列表下方，圆角交给列表 */
	.now-playing.has-list .np-collapse {
		border-top-right-radius: 0;
	}

	.np-collapse:hover {
		color: var(--primary);
	}

	.np-collapse-chevron {
		display: grid;
		place-items: center;
		transform: rotate(180deg);
		transition: transform 0.24s var(--ease-standard);
	}

	.np-collapse-chevron.is-flipped {
		transform: none;
	}

	:global(.dark) .np-collapse {
		color: oklch(0.75 0.02 var(--hue));
	}

	/* ── 播放列表：上沿向上展开，底色由根元素统一负责 ── */
	.np-list {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		max-height: 0;
		opacity: 0;
		overflow: hidden;
		/* 只做裁切（行 hover 底色不越过右上圆角），底色仍由根元素统一负责 */
		border-top-right-radius: var(--radius-large);
		transition:
			max-height 0.28s var(--ease-standard),
			opacity 0.2s var(--ease-standard);
	}

	.np-list.is-open {
		max-height: min(38vh, 15rem);
		opacity: 1;
	}

	.np-list-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.np-list-empty {
		padding: 0.625rem 0.875rem;
		font-size: 0.6875rem;
		color: oklch(0.5 0.02 var(--hue));
	}

	.np-list-items {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.np-item {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		padding: 0.4375rem 0.875rem 0.4375rem 0.75rem;
		font-size: 0.8125rem;
		line-height: 1.25rem;
		text-align: left;
		color: oklch(0.3 0.02 var(--hue));
		transition:
			background-color 0.16s var(--ease-standard),
			color 0.16s var(--ease-standard);
	}

	/* 行间细线（首行不留） */
	li:not(:first-child) .np-item {
		border-top: 1px solid var(--line-divider);
	}

	.np-item:hover {
		background-color: var(--btn-plain-bg-hover);
	}

	/* 当前曲目：贴左边缘的主题色竖条 + 淡主题色底 */
	.np-item.is-active {
		position: relative;
		color: var(--primary);
		background-color: color-mix(in oklch, var(--primary) 10%, transparent);
	}

	.np-item.is-active::before {
		content: "";
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background-color: var(--primary);
	}

	.np-item-index {
		flex: none;
		min-width: 0.875rem;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		text-align: right;
		color: oklch(0.55 0.02 var(--hue));
	}

	.np-item.is-active .np-item-index {
		color: var(--primary);
		font-weight: 600;
	}

	.np-item-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.np-item-artist {
		flex: none;
		max-width: 45%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 0.75rem;
		color: oklch(0.5 0.02 var(--hue));
	}

	:global(.dark) .np-item {
		color: oklch(0.88 0.02 var(--hue));
	}

	:global(.dark) .np-item-index,
	:global(.dark) .np-item-artist {
		color: oklch(0.68 0.02 var(--hue));
	}

	:global(.dark) .np-item.is-active {
		color: var(--primary);
	}

	:global(.dark) .np-item.is-active .np-item-index {
		color: var(--primary);
	}

	@media (max-width: 520px) {
		/* 移动端铺满底部；基础高度收到 4rem，展开歌词行再多一行，
		   右下浮动按钮列（bottom:4rem）会跟着上移，详见 FloatingControls */
		.now-playing {
			width: 100vw;
			border-top-right-radius: 0;
			border-right: none;
		}

		/* 收起态只剩 4rem 封面 + 1.25rem 箭头 */
		.now-playing.is-mini {
			width: 5.25rem;
		}

		.np-row {
			height: calc(
				4rem + var(--np-lyric-h, 0rem) + env(safe-area-inset-bottom, 0px)
			);
		}

		.np-cover {
			width: 4rem;
		}

		.np-disc {
			width: 4rem;
			height: 4rem;
		}

		/* 4rem 里塞两行：内边距和按钮一起缩一档 */
		.np-main {
			gap: 0.125rem;
			padding: 0.25rem 0.375rem 0.25rem 0.625rem;
		}

		.np-actions {
			gap: 0;
		}

		.np-btn {
			width: 1.5rem;
			height: 1.5rem;
		}

		.np-btn-quiet {
			width: 1.375rem;
			height: 1.375rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.now-playing {
			transition: opacity 0.2s linear;
			transform: none;
		}

		.np-marquee.is-scrolling {
			animation: none;
		}

		/* 关闭旋转动效，封面只作静态圆形图 */
		.np-disc {
			animation: none;
		}

		.np-btn:active,
		.np-cover-btn {
			transition: none;
		}

		.np-volume-pop {
			transition: none;
		}

		/* 歌词换句不做过场，直接换字 */
		.np-lyric-text {
			animation: none;
		}

		/* 开关歌词时高度直接跳，不做展开收起动画 */
		.np-row,
		.np-lyric {
			transition: none;
		}
	}
</style>
