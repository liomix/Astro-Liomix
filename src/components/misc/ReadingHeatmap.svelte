<script lang="ts">
/**
 * 阅读时间热力图（GitHub 贡献图样式）
 * ----------------------------------------------------------------------------
 * 一年一屏：列 = 周，行 = 周日→周六，颜色深浅 = 当天阅读时长。
 * 档位按该年「有记录的那些天」的分位数切 4 档，稀疏年份也不会一片同色。
 * 数据在构建时抓好后按 "YYYY-MM-DD" → 秒数传进来，切换年份纯前端计算。
 */
import { tick } from "svelte";
import { formatDuration } from "@utils/date-utils";

interface Props {
	/** 有阅读记录的年份，倒序（最新在前） */
	years: number[];
	/** "YYYY-MM-DD" → 当天阅读秒数 */
	days: Record<string, number>;
	/** 12 个月份短名 */
	months: string[];
	/** 7 个星期短名，周日开头 */
	weekdays: string[];
	title: string;
	lessLabel: string;
	moreLabel: string;
	/** "{d} 天有记录 · 共 {h} 小时" */
	summaryTemplate: string;
	emptyLabel: string;
}

let {
	years,
	days,
	months,
	weekdays,
	title,
	lessLabel,
	moreLabel,
	summaryTemplate,
	emptyLabel,
}: Props = $props();

const MS_DAY = 86_400_000;

/** 用户选中的年份；null 表示跟着「最新有记录的年份」走 */
let picked = $state<number | null>(null);
/**
 * 悬停提示：用 fixed 定位并挂到 body（见 portal），
 * x/y 是视口坐标，below 表示因上方空间不足改画在格子下方。
 */
let tip = $state<{
	x: number;
	y: number;
	text: string;
	below: boolean;
} | null>(null);
let tipEl: HTMLElement | null = $state(null);
/** hover 序号：用来丢弃「量尺寸期间已被顶掉」的过期定位 */
let tipSeq = 0;
/** 年份下拉是否展开（旧年份从按钮正上方弹出） */
let open = $state(false);
let yearPicker: HTMLElement | null = $state(null);

const year = $derived(picked ?? years[0] ?? new Date().getFullYear());

interface Cell {
	key: string;
	seconds: number;
	level: number;
}

const isoDate = (utcMillis: number) =>
	new Date(utcMillis).toISOString().slice(0, 10);

const view = $derived.by(() => {
	const jan1 = Date.UTC(year, 0, 1);
	const total = Math.round((Date.UTC(year + 1, 0, 1) - jan1) / MS_DAY);
	// 该年 1 月 1 日是周几（0 = 周日），决定第一列前面空几格
	const lead = new Date(jan1).getUTCDay();
	const cols = Math.ceil((lead + total) / 7);

	// 先统计有记录的天，用来算分位数和汇总
	const values: number[] = [];
	let seconds = 0;
	for (let i = 0; i < total; i++) {
		const s = days[isoDate(jan1 + i * MS_DAY)] ?? 0;
		if (s > 0) {
			values.push(s);
			seconds += s;
		}
	}
	values.sort((a, b) => a - b);

	const cut = (p: number) =>
		values.length ? values[Math.floor(p * (values.length - 1))] : 0;
	const cuts = values.length ? [cut(0.2), cut(0.45), cut(0.7), cut(0.9)] : [];
	const levelOf = (s: number) => {
		if (s <= 0) return 0;
		let level = 1;
		for (const threshold of cuts) if (s > threshold) level++;
		return Math.min(4, level);
	};

	// 列优先铺满：每 7 个格子一列（周日 → 周六）
	// 今天之后的格子直接留空（画成灰底会显得「漏读」）
	const todayKey = isoDate(Date.now());
	const cells: Array<Cell | null> = [];
	for (let i = 0; i < cols * 7; i++) {
		const index = i - lead;
		if (index < 0 || index >= total) {
			cells.push(null);
			continue;
		}
		const key = isoDate(jan1 + index * MS_DAY);
		if (key > todayKey) {
			cells.push(null);
			continue;
		}
		const s = days[key] ?? 0;
		cells.push({ key, seconds: s, level: levelOf(s) });
	}

	// 月份标签：标在该月第一天所在的那一列，同一列只留一个
	const labels: Array<{ text: string; col: number }> = [];
	months.forEach((text, month) => {
		const dayIndex = Math.round((Date.UTC(year, month, 1) - jan1) / MS_DAY);
		const col = Math.floor((lead + dayIndex) / 7);
		if (labels.at(-1)?.col === col) return;
		labels.push({ text, col });
	});

	const activeDays = values.length;
	const hours = seconds / 3600;
	const hoursText =
		hours <= 0 ? "0" : hours >= 100 ? String(Math.round(hours)) : hours.toFixed(1);

	return {
		cells,
		cols,
		labels,
		activeDays,
		empty: activeDays === 0,
		summary: summaryTemplate
			.replace("{d}", String(activeDays))
			.replace("{h}", hoursText),
	};
});

function formatCellText(cell: Cell): string {
	const date = cell.key.slice(5).replace("-", "/");
	return `${date} · ${formatDuration(cell.seconds)}`;
}

/**
 * 把浮层挂到 body 上。
 * 祖先只要有一层 transform / filter / contain，position: fixed 就会改以该祖先为包含块，
 * 此时算出来的视口坐标会整体偏掉 —— 挪到 body 下才能保证相对视口定位。
 */
function portal(node: HTMLElement) {
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		},
	};
}

async function showTip(event: PointerEvent, cell: Cell) {
	const seq = ++tipSeq;
	const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
	const text = formatCellText(cell);
	const centerX = rect.left + rect.width / 2;

	// 先按「格子上方居中」渲染一次，量出真实尺寸后再夹进视口
	tip = { x: centerX, y: rect.top - 8, text, below: false };
	await tick();

	// 量尺寸期间指针可能已经移走，或被下一次 hover 顶掉
	const el = tipEl;
	if (seq !== tipSeq || !el) return;

	// 横向夹紧：左右各留 8px，靠边的格子也不会把提示顶出屏幕
	const half = el.offsetWidth / 2 + 8;
	const x = Math.min(Math.max(centerX, half), window.innerWidth - half);
	// 上方放不下就翻到格子下面
	const below = rect.top - 8 - el.offsetHeight < 8;

	tip = {
		x,
		y: below ? rect.bottom + 8 : rect.top - 8,
		text,
		below,
	};
}

function hideTip() {
	tipSeq++;
	tip = null;
}

function pickYear(next: number) {
	picked = next;
	open = false;
	hideTip();
}

/** 点到选择器以外的地方就收起下拉 */
function onPointerDown(event: PointerEvent) {
	if (!open) return;
	const target = event.target as Node | null;
	if (target && yearPicker?.contains(target)) return;
	open = false;
}

function onKeydown(event: KeyboardEvent) {
	if (event.key === "Escape") open = false;
}
</script>

<div class="heatmap">
	<div class="heatmap-head">
		<h3 class="heatmap-title">{title}</h3>
		{#if years.length > 1}
			<div class="heatmap-years" bind:this={yearPicker}>
				<button
					type="button"
					class="heatmap-year-trigger"
					class:is-open={open}
					aria-expanded={open}
					onclick={() => (open = !open)}
				>
					{year}
					<svg
						class="heatmap-caret"
						viewBox="0 0 24 24"
						aria-hidden="true"
						focusable="false"
					>
						<path
							fill="currentColor"
							d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"
						/>
					</svg>
				</button>

				{#if open}
					<!-- 旧年份从按钮正上方弹出 -->
					<div class="heatmap-year-menu">
						{#each years as item (item)}
							<button
								type="button"
								class="heatmap-year-option"
								class:is-active={item === year}
								onclick={() => pickYear(item)}
							>
								{item}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if view.empty}
		<p class="heatmap-empty">{emptyLabel}</p>
	{:else}
		<!-- 灰色细线把本体圈起来；宽度跟着内容走，所以 margin 居中即可 -->
		<div class="heatmap-frame">
			<div class="heatmap-body">
				<div class="heatmap-weekdays" aria-hidden="true">
					{#each weekdays as label, index (label)}
						<span>{index === 1 || index === 3 || index === 5 ? label : ""}</span>
					{/each}
				</div>

				<div class="heatmap-scroll" onscroll={hideTip}>
					<div class="heatmap-months" style="--cols:{view.cols}">
						{#each view.labels as label (label.text)}
							<span style="--col:{label.col}">{label.text}</span>
						{/each}
					</div>

					<div class="heatmap-grid" style="--cols:{view.cols}">
						{#each view.cells as cell}
							{#if cell}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span
									class="heatmap-cell"
									data-level={cell.level}
									role="img"
									aria-label={formatCellText(cell)}
									onpointerenter={(event) => showTip(event, cell)}
									onpointerleave={hideTip}
								></span>
							{:else}
								<span class="heatmap-cell is-blank"></span>
							{/if}
						{/each}
					</div>
				</div>
			</div>

			<div class="heatmap-foot">
				<span class="heatmap-summary">{view.summary}</span>
				<span class="heatmap-legend">
					<span>{lessLabel}</span>
					{#each [0, 1, 2, 3, 4] as level (level)}
						<i class="heatmap-cell" data-level={level}></i>
					{/each}
					<span>{moreLabel}</span>
				</span>
			</div>
		</div>
	{/if}
</div>

{#if tip}
	<div
		class="heatmap-tip"
		class:is-below={tip.below}
		bind:this={tipEl}
		use:portal
		style="left:{tip.x}px;top:{tip.y}px"
	>
		{tip.text}
	</div>
{/if}

<svelte:window
	onscroll={hideTip}
	onpointerdown={onPointerDown}
	onkeydown={onKeydown}
/>

<style>
	.heatmap {
		/* 格子尺寸：桌面 12px，窄屏缩到 9px（列多时靠横向滚动兜底） */
		--cell: 12px;
		--gap: 3px;
		--heat-empty: rgb(0 0 0 / 6%);
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	:global(:root.dark) .heatmap {
		--heat-empty: rgb(255 255 255 / 7%);
	}

	.heatmap-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 0.75rem;
	}

	.heatmap-title {
		margin: 0;
		color: rgb(0 0 0 / 88%);
		font-size: 0.95rem;
		font-weight: 700;
		line-height: 1.3;
	}

	:global(:root.dark) .heatmap-title {
		color: rgb(255 255 255 / 90%);
	}

	/* 年份选择器：平时只显示当前年份，点开才从正上方弹出旧年份 */
	.heatmap-years {
		position: relative;
		flex: none;
	}

	.heatmap-year-trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.22rem;
		padding: 0.26rem 0.6rem 0.26rem 0.72rem;
		border: none;
		border-radius: 999px;
		background: var(--primary);
		color: white;
		cursor: pointer;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		line-height: 1.2;
		transition: background 0.2s ease;
	}

	.heatmap-year-trigger:hover {
		background: color-mix(in srgb, var(--primary) 86%, black);
	}

	.heatmap-caret {
		width: 0.9em;
		height: 0.9em;
		transition: transform 0.2s ease;
	}

	.heatmap-year-trigger.is-open .heatmap-caret {
		transform: rotate(180deg);
	}

	.heatmap-year-menu {
		position: absolute;
		z-index: 30;
		/* 贴着按钮正上方，水平中点对齐 */
		bottom: calc(100% + 0.35rem);
		left: 50%;
		display: flex;
		flex-direction: column;
		min-width: 100%;
		padding: 0.2rem;
		border: 1px solid rgb(0 0 0 / 12%);
		border-radius: 0.75rem;
		background: var(--card-bg);
		box-shadow: 0 10px 26px -14px rgb(0 0 0 / 30%);
		transform: translateX(-50%);
	}

	:global(:root.dark) .heatmap-year-menu {
		border-color: rgb(255 255 255 / 14%);
		box-shadow: 0 12px 32px -16px rgb(0 0 0 / 75%);
	}

	.heatmap-year-option {
		padding: 0.34rem 0.7rem;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--content-meta);
		cursor: pointer;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		line-height: 1.2;
		text-align: center;
		white-space: nowrap;
		transition:
			background 0.15s ease,
			color 0.15s ease;
	}

	.heatmap-year-option:hover {
		background: var(--btn-regular-bg-hover);
		color: var(--primary);
	}

	.heatmap-year-option.is-active {
		color: var(--primary);
		font-weight: 600;
	}

	/* 灰色细线圈住热力图本体：宽度跟随内容，靠 margin auto 在卡片里居中 */
	.heatmap-frame {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		width: fit-content;
		max-width: 100%;
		margin-inline: auto;
		padding: 0.7rem 0.85rem 0.6rem;
		/* 比 --line-divider（8%）更实一档，细线才看得出来 */
		border: 1px solid rgb(0 0 0 / 18%);
		border-radius: 0.65rem;
	}

	:global(:root.dark) .heatmap-frame {
		border-color: rgb(255 255 255 / 22%);
	}

	.heatmap-body {
		display: flex;
		gap: 0.4rem;
		min-width: 0;
	}

	.heatmap-weekdays {
		display: grid;
		flex: none;
		grid-template-rows: repeat(7, var(--cell));
		gap: var(--gap);
		/* 空出上面月份标签那一行，让第一行与网格第一行对齐 */
		padding-top: calc(1.05rem + 0.3rem);
		color: var(--content-meta);
		font-size: 0.65rem;
		line-height: var(--cell);
	}

	.heatmap-scroll {
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		padding-bottom: 2px;
		scrollbar-width: thin;
	}

	.heatmap-months {
		position: relative;
		width: calc(var(--cols) * (var(--cell) + var(--gap)) - var(--gap));
		height: 1.05rem;
	}

	.heatmap-months span {
		position: absolute;
		top: 0;
		left: calc(var(--col) * (var(--cell) + var(--gap)));
		color: var(--content-meta);
		font-size: 0.65rem;
		line-height: 1;
		white-space: nowrap;
	}

	.heatmap-grid {
		display: grid;
		grid-auto-flow: column;
		grid-template-rows: repeat(7, var(--cell));
		grid-auto-columns: var(--cell);
		gap: var(--gap);
		width: calc(var(--cols) * (var(--cell) + var(--gap)) - var(--gap));
	}

	.heatmap-cell {
		display: block;
		width: var(--cell);
		height: var(--cell);
		border-radius: 2px;
		background: var(--heat-empty);
	}

	/* 该年无数据的天（首尾补位）不画底色 */
	.heatmap-cell.is-blank {
		background: transparent;
	}

	.heatmap-cell[data-level="1"] {
		background: color-mix(in srgb, var(--primary) 26%, transparent);
	}

	.heatmap-cell[data-level="2"] {
		background: color-mix(in srgb, var(--primary) 45%, transparent);
	}

	.heatmap-cell[data-level="3"] {
		background: color-mix(in srgb, var(--primary) 68%, transparent);
	}

	.heatmap-cell[data-level="4"] {
		background: var(--primary);
	}

	.heatmap-cell:hover {
		box-shadow: 0 0 0 1px rgb(0 0 0 / 22%);
	}

	.heatmap-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem 0.75rem;
	}

	.heatmap-summary {
		color: var(--content-meta);
		font-size: 0.72rem;
	}

	.heatmap-legend {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--content-meta);
		font-size: 0.68rem;
	}

	.heatmap-legend i {
		border-radius: 2px;
		font-style: normal;
	}

	.heatmap-empty {
		margin: 0;
		padding: 1.6rem 0;
		color: var(--content-meta);
		font-size: 0.8rem;
		text-align: center;
	}

	.heatmap-tip {
		position: fixed;
		z-index: 999;
		padding: 0.3rem 0.55rem;
		border-radius: 0.45rem;
		background: rgb(24 24 27 / 92%);
		color: white;
		font-size: 0.7rem;
		line-height: 1.2;
		pointer-events: none;
		transform: translate(-50%, -100%);
		white-space: nowrap;
	}

	/* 上方空间不足时翻到格子下面，不再整体上移自身高度 */
	.heatmap-tip.is-below {
		transform: translate(-50%, 0);
	}

	@media (max-width: 720px) {
		.heatmap {
			--cell: 9px;
			--gap: 2px;
		}

		.heatmap-weekdays {
			font-size: 0.6rem;
		}
	}
</style>
