<script lang="ts">
/**
 * 3D 书架（复刻 mikufoxxx/Wenku8_Flutter 的立方书架）
 * ----------------------------------------------------------------------------
 * 几何常量取自 lib/archive_shelf_geometry.dart，并按本项目的版式放大过：
 *   depthX 0.66 / depthY -0.30（斜投影方向）、rowStep 2.5（波形轨距）、
 *   spine = w*.03∈[13,18]、pitch = spine+11、cover = w*.33∈[118,180]、
 *   height = (cover-20)*166/118 + 54、pull = cover*.84。
 * 书脊与封面里的字号、内边距都乘同一个系数 cover/128，书本放大时排版一起放大。
 * 单本书 = 书脊面 + 封面 + 顶面，三个面都是平行四边形，
 * 用 CSS matrix() 直接画（不做真透视，和原实现一样是斜投影）。
 * 聚焦度 weight = cos(d/1.48 * π/2)²：中心书沿深度滑出 pull 距离并抬起 0.6h，
 * 两侧 1 本内还有余量，再远就回到队列里。
 */
import Icon from "@/components/common/Icon.svelte";
import { onMount } from "svelte";
import BookPop from "./BookPop.svelte";

export interface ShelfBook {
	id: string;
	title: string;
	author: string;
	cover: string;
	category: string;
	link: string;
	finished: boolean;
	onShelf: boolean;
	/** 预格式化的最近阅读时间，空串表示没有记录 */
	lastReadText: string;
}

interface Props {
	books: ShelfBook[];
	readingLabel: string;
	finishedLabel: string;
	prevLabel: string;
	nextLabel: string;
	openLabel: string;
	emptyLabel: string;
}

let {
	books,
	readingLabel,
	finishedLabel,
	prevLabel,
	nextLabel,
	openLabel,
	emptyLabel,
}: Props = $props();

// ---- 原项目的几何常量 ----
const DEPTH_X = 0.66;
const DEPTH_Y = -0.3;
const ROW_STEP = 2.5;
const RADIUS = 1.48;
const MAX_VIEWPORT = 620;
const SPINE_GAP = 11;
/** 封面宽度的旧基准值：封面变大时，书脊与封面里的字号按同比例放大 */
const COVER_BASE = 128;

const clamp = (v: number, min: number, max: number) =>
	Math.min(max, Math.max(min, v));

// Dart 的 % 对正除数永远返回非负，JS 要自己补
const mod = (a: number, b: number) => ((a % b) + b) % b;

let stage = $state<HTMLDivElement>();
/** 视口宽度，未测量前先按手机宽度画，水合后校正 */
let width = $state(360);
/** 焦点位置（书序号空间，可以是小数，拖拽时连续变化） */
let logical = $state(0);
let target = $state(0);
let reduced = $state(false);
/** 正在查看详情的书，null 表示弹窗关闭 */
let popBook = $state<ShelfBook | null>(null);

let raf = 0;
let wheelTimer: ReturnType<typeof setTimeout> | undefined;

const geo = $derived.by(() => {
	const w = Math.min(width || MAX_VIEWPORT, MAX_VIEWPORT);
	const spine = clamp(w * 0.03, 13, 18);
	const pitch = spine + SPINE_GAP;
	// 书变高变厚：封面深度取视口的三分之一多一点，上下限都不再压着它
	const cover = clamp(w * 0.33, 118, 180);
	const height = ((cover - 20) * 166) / 118 + 54;
	const footprint = spine + cover * DEPTH_X;
	const pull = cover * 0.84;
	// 书的原点（书脊左上角在静止状态下）落在这条基线上
	const baseY = -cover * DEPTH_Y + height * 0.6 + 12;
	const startX = w / 2 - footprint / 2 + pull * DEPTH_X;
	// 循环池左右各留多少槽位，保证任意焦点下都能把视口铺满
	const edge = Math.ceil((w / 2 + footprint + pull * DEPTH_X) / pitch) + 2;

	return {
		w,
		spine,
		pitch,
		cover,
		height,
		footprint,
		pull,
		baseY,
		startX,
		edge,
		/** 书脊/封面内部文字、内边距的等比缩放系数 */
		scale: cover / COVER_BASE,
		stageHeight: Math.round(baseY + height + 14),
		// 三个面 + 地面投影的变换矩阵（cover 面带书脊宽度与 0.1 的竖向错位）
		matSpine: "matrix(1,0.1,0,1,0,0)",
		matCover: `matrix(${DEPTH_X},${DEPTH_Y},0,1,${spine},${spine * 0.1})`,
		matTop: `matrix(1,0.1,${DEPTH_X},${DEPTH_Y},0,0)`,
	};
});

/** 焦点槽位：循环时整体右移 edge 个槽 */
const focusSlot = $derived(
	books.length < 2 ? 0 : geo.edge + mod(logical, books.length),
);

type Slot = {
	/** 槽序号，作为 DOM key（同一槽永远对应同一本书） */
	slot: number;
	book: ShelfBook;
	/** 在 books 里的真实下标，决定编号与文案 */
	index: number;
	x: number;
	y: number;
	weight: number;
	focused: boolean;
};

const slots = $derived.by<Slot[]>(() => {
	const g = geo;
	const count = books.length;
	if (count === 0 || !g.w) return [];

	const looping = count >= 2;
	const pool = looping ? count + g.edge * 2 : count;
	const indexAt = (slot: number) =>
		looping ? mod(slot - g.edge, count) : clamp(slot, 0, count - 1);

	// 只渲染可能落进视口的槽位：x 从 startX 起每 pitch 一格
	const lo = Math.max(
		0,
		Math.ceil(focusSlot + (-g.startX - g.footprint) / g.pitch) - 1,
	);
	const hi = Math.min(
		pool - 1,
		Math.floor(focusSlot + (g.w - g.startX) / g.pitch) + 1,
	);

	const out: Slot[] = [];
	for (let slot = lo; slot <= hi; slot++) {
		const d = slot - focusSlot;
		const distance = Math.abs(d);
		const weight =
			distance >= RADIUS
				? 0
				: Math.cos((distance / RADIUS) * (Math.PI / 2)) ** 2;
		// 越远离中心越往下掉（负方向往上），形成原实现那条浅波形
		const rail = clamp(d, -7, 7);
		const railY = rail * ROW_STEP + rail * rail * 0.45;
		const pull = g.pull * weight * (1.24 - 0.24 * weight);
		const lift = weight * weight * (3 - 2 * weight);
		const index = indexAt(slot);
		out.push({
			slot,
			book: books[index],
			index,
			x: g.startX + (slot - focusSlot) * g.pitch - pull * DEPTH_X,
			y: railY + g.baseY - pull * DEPTH_Y - g.height * 0.6 * lift,
			weight,
			focused: distance < 0.5,
		});
	}
	return out;
});

const active = $derived(
	books.length === 0 ? null : books[mod(Math.round(logical), books.length)],
);
const activeNumber = $derived(
	books.length === 0 ? 0 : mod(Math.round(logical), books.length) + 1,
);

function animateTo(next: number) {
	if (!Number.isFinite(next)) return;
	target = next;
	cancelAnimationFrame(raf);
	const from = logical;
	if (reduced || Math.abs(next - from) < 0.001) {
		logical = next;
		return;
	}
	// 走得越远，动画越长，但别拖太久
	const duration = Math.min(760, 300 + Math.abs(next - from) * 90);
	const start = performance.now();
	const tick = (now: number) => {
		const p = Math.min(1, (now - start) / duration);
		const eased = 1 - (1 - p) ** 3;
		logical = from + (next - from) * eased;
		if (p < 1) raf = requestAnimationFrame(tick);
	};
	raf = requestAnimationFrame(tick);
}

function step(delta: number) {
	animateTo(Math.round(logical) + delta);
}

// ---- 拖拽 / 滚轮 / 键盘 ----
let drag: {
	x: number;
	from: number;
	moved: boolean;
	/** pointerdown 时命中的书（槽序号），用于区分「点击」和「拖拽」 */
	slotNo: number | null;
} | null = null;
let suppressClick = false;

function onPointerDown(event: PointerEvent) {
	if (event.pointerType === "mouse" && event.button !== 0) return;
	cancelAnimationFrame(raf);
	const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(
		".shelf-book",
	);
	drag = {
		x: event.clientX,
		from: logical,
		moved: false,
		slotNo: el?.dataset.slot == null ? null : Number(el.dataset.slot),
	};
	suppressClick = false;
	// 这里**不能**立刻 setPointerCapture：指针捕获会把 pointerup 以及随后的 click
	// 一起重定向到舞台，书上的点击就永远收不到了。等真的开始拖再捕获。
}

function onPointerMove(event: PointerEvent) {
	if (!drag) return;
	const dx = event.clientX - drag.x;
	if (!drag.moved && Math.abs(dx) > 3) {
		drag.moved = true;
		// 确认是拖拽后再捕获，手指/鼠标移出舞台也能继续跟手
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}
	if (drag.moved) logical = drag.from - dx / geo.pitch;
}

function onPointerUp(event: PointerEvent) {
	if (!drag) return;
	const { moved, slotNo } = drag;
	drag = null;
	if (moved) {
		suppressClick = true;
		animateTo(Math.round(logical));
		setTimeout(() => {
			suppressClick = false;
		}, 0);
		return;
	}
	// 没有拖动 = 一次点击：命中哪本书就激活哪本
	if (slotNo === null) return;
	const hit = slots.find((item) => item.slot === slotNo);
	if (hit) activateBook(hit, event);
}

/** 指针被系统收走（触摸滚动等）：只收尾，不算点击 */
function onPointerCancel() {
	if (!drag) return;
	const moved = drag.moved;
	drag = null;
	if (moved) animateTo(Math.round(logical));
}

/** 点一下书：非中心书先归位到中间，已经在中间的直接看详情 */
function activateBook(slot: Slot, event: MouseEvent | PointerEvent) {
	if (slot.slot !== Math.round(focusSlot)) {
		animateTo(Math.round(logical + (slot.slot - focusSlot)));
		return;
	}
	// 保留 Ctrl/⌘/Shift+点击 直接开新标签页的习惯
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
		window.open(slot.book.link, "_blank", "noopener,noreferrer");
		return;
	}
	popBook = slot.book;
}

function onBookClick(event: MouseEvent, slot: Slot) {
	// 鼠标/触摸的点击统一在 pointerup 里处理（指针捕获可能重定向事件，两边都接会重复触发），
	// 这里只负责拦住链接跳转，以及接住键盘 Enter（detail 为 0 的合成点击）。
	event.preventDefault();
	if (event.detail === 0 && !suppressClick) activateBook(slot, event);
}

function onKeydown(event: KeyboardEvent) {
	if (event.key === "ArrowLeft") {
		event.preventDefault();
		step(-1);
	} else if (event.key === "ArrowRight") {
		event.preventDefault();
		step(1);
	}
}

onMount(() => {
	reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const observer = new ResizeObserver((entries) => {
		const next = entries[0]?.contentRect.width ?? 0;
		if (next > 0) width = next;
	});
	if (stage) observer.observe(stage);

	// 横向滚轮 / Shift+滚轮翻书；纵向滚轮留给页面
	const onWheel = (event: WheelEvent) => {
		const horizontal =
			Math.abs(event.deltaX) > Math.abs(event.deltaY);
		const delta = horizontal
			? event.deltaX
			: event.shiftKey
				? event.deltaY
				: 0;
		if (!delta) return;
		event.preventDefault();
		cancelAnimationFrame(raf);
		logical += delta / (geo.pitch * 4);
		clearTimeout(wheelTimer);
		wheelTimer = setTimeout(() => animateTo(Math.round(logical)), 140);
	};
	stage?.addEventListener("wheel", onWheel, { passive: false });

	return () => {
		observer.disconnect();
		stage?.removeEventListener("wheel", onWheel);
		cancelAnimationFrame(raf);
		clearTimeout(wheelTimer);
	};
});
</script>

<div class="books-shelf">
	{#if books.length === 0}
		<p class="books-empty">{emptyLabel}</p>
	{:else}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="books-shelf-stage"
			bind:this={stage}
			style="height:{geo.stageHeight}px;--shelf-s:{geo.scale.toFixed(3)}"
			role="listbox"
			tabindex="0"
			aria-label={openLabel}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerCancel}
			onkeydown={onKeydown}
		>
			{#each slots as slot (slot.slot)}
				{@const no2 = String(slot.index + 1).padStart(2, "0")}
				{@const no3 = String(slot.index + 1).padStart(3, "0")}
				<a
					class="shelf-book"
					class:is-focused={slot.focused}
					href={slot.book.link}
					target="_blank"
					rel="noopener noreferrer"
					data-slot={slot.slot}
					aria-label="{slot.book.title} · {slot.book.author}"
					aria-selected={slot.focused}
					role="option"
					style="transform:translate3d({slot.x.toFixed(2)}px,{slot.y.toFixed(2)}px,0)"
					onclick={(event) => onBookClick(event, slot)}
				>
					<span
						class="shelf-top"
						style="width:{geo.spine}px;height:{geo.cover}px;transform:{geo.matTop}"
					></span>
					<span
						class="shelf-spine"
						style="width:{geo.spine}px;height:{geo.height}px;transform:{geo.matSpine}"
					>
						<span class="spine-code">{no2}</span>
						<span class="spine-title">{slot.book.title}</span>
						<span class="spine-dot"></span>
					</span>
					<span
						class="shelf-cover"
						style="width:{geo.cover}px;height:{geo.height}px;transform:{geo.matCover}"
					>
						<span class="cover-head">
							<span class="cover-code">NO.{no3}</span>
						</span>
						<span class="cover-art">
							{#if slot.book.cover}
								<img
									src={slot.book.cover}
									alt=""
									loading="lazy"
									decoding="async"
									referrerpolicy="no-referrer"
								/>
							{:else}
								<span class="cover-blank">
									<Icon icon="material-symbols:menu-book" />
								</span>
							{/if}
						</span>
						<span class="cover-foot">WK-{slot.book.id}</span>
					</span>
				</a>
			{/each}
		</div>

		<div class="books-shelf-meta">
			<div class="shelf-meta-text">
				<a
					class="shelf-meta-title"
					href={active?.link ?? "#"}
					target="_blank"
					rel="noopener noreferrer"
				>
					{active?.title ?? ""}
				</a>
				<span class="shelf-meta-sub">
					{active?.author ?? ""}
					<i>·</i>
					{active?.finished ? finishedLabel : readingLabel}
				</span>
			</div>
			<div class="shelf-pager">
				<button
					type="button"
					class="shelf-pager-btn"
					aria-label={prevLabel}
					onclick={() => step(-1)}
				>
					<Icon icon="material-symbols:chevron-left-rounded" />
				</button>
				<span class="shelf-pager-count">
					{String(activeNumber).padStart(2, "0")}
					<i>/</i>
					{String(books.length).padStart(2, "0")}
				</span>
				<button
					type="button"
					class="shelf-pager-btn"
					aria-label={nextLabel}
					onclick={() => step(1)}
				>
					<Icon icon="material-symbols:chevron-right-rounded" />
				</button>
			</div>
		</div>

		<BookPop book={popBook} onClose={() => (popBook = null)} />
	{/if}
</div>
