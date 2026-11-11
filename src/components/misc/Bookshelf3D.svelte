<script lang="ts">
/**
 * 3D 书架 —— 按 Wenku8_Flutter 的 archive_wave.dart / archive_shelf_geometry.dart 复刻
 * ----------------------------------------------------------------------------
 * 几何（原值，再统一乘缩放 s）：
 *   depthX .66 / depthY -.30  —— 斜投影方向（不做真透视）
 *   spine = 18、cover = 128、pitch = spine + 11 = 29、pull = cover*.84
 *   height = (cover-20)*166/118 + 54、baseY = -cover*depthY + height*.6 + 12
 *   railY(d) = d*2.5 + d²*0.45   —— 底部弧线，d 是「离中心几本书」
 * 书台基准宽度 520（原实现的 maxViewportWidth），按卡片宽度等比放大，上限 1.4 倍，
 * 由 s 控制所有尺寸与字号，所以放大时排版一起放大，不会出现「书变大字不变」。
 *
 * 每本书 = 三个面，全部用 CSS matrix() 斜投影：
 *   封面（最底层，只露出窄窄一条）→ 顶面（纸叠截面）→ 书脊（最上层）。
 * 绘制顺序与原实现一致：封面先画，书脊最后画，所以书脊永远压在自己的封面上。
 *
 * 交互：拖拽 / 横向滚轮 / ←→ 翻书，松手走 planScroll 的摩擦 + 落位两段物理，
 * 一定停在整数书位；点非中心的书先滑到中间，点中心书打开详情。
 * 书列首尾相连（和原实现一致，可无限滑），所以焦点永远在正中，弧线绝对不动。
 */
import Icon from "@/components/common/Icon.svelte";
import { cubicBezier, planScroll } from "@/utils/shelf-physics";
import { onMount } from "svelte";
import BookPop from "./BookPop.svelte";

export interface ShelfBook {
	id: string;
	title: string;
	author: string;
	cover: string;
	link: string;
	/** 阅读状态：在读 / 读过 / 读完 */
	status: "reading" | "read" | "finished";
	/** 书籍简介，可能为空 */
	intro: string;
	/** 预格式化的字数，如「22.4 万字」，空串表示未知 */
	wordsText: string;
	/** 预格式化的评分，如「9.1 分」，空串表示暂无评分 */
	scoreText: string;
	/** 预格式化的评分人数标签，如「2376人评分」，空串表示没取到 */
	ratingLabel: string;
}

interface Props {
	books: ShelfBook[];
	readingLabel: string;
	readLabel: string;
	finishedLabel: string;
	openLabel: string;
	emptyLabel: string;
}

let {
	books,
	readingLabel,
	readLabel,
	finishedLabel,
	openLabel,
	emptyLabel,
}: Props = $props();

// 书脊 / 封面上的状态文案
function statusLabel(status: ShelfBook["status"]): string {
	if (status === "finished") return finishedLabel;
	if (status === "read") return readLabel;
	return readingLabel;
}

// ---- 原实现的几何常量 ----
const DEPTH_X = 0.66;
const DEPTH_Y = -0.3;
/** 弧线的线性项：每离开中心一本书，底边下沉多少 */
const ROW_STEP = 2.5;
/** 弧线的二次项：越远沉得越快 */
const ROW_CURVE = 0.45;
/** 弧线最多算到几本书，再远就压平（原实现的 clamp ±7） */
const RAIL_CLAMP = 7;
/** 聚焦度半径：隔一本书以外完全回到队列 */
const RADIUS = 1.48;
/** 书台基准宽度：原实现 maxViewportWidth = 520 */
const BASE_WIDTH = 520;
/** 窄屏不缩得太小（手机上正好是 App 的尺寸） */
const MIN_SCALE = 0.85;
/** 宽屏的上限：再大书架就太高了（1.55 倍 ≈ 600px 高的书台） */
const MAX_SCALE = 1.55;

const clamp = (v: number, lo: number, hi: number) =>
	Math.min(hi, Math.max(lo, v));

const mod = (a: number, b: number) => ((a % b) + b) % b;

let stage = $state<HTMLDivElement>();
/** 视口宽度，未测量前先按手机宽度画，水合后校正 */
let width = $state(360);
/** 焦点位置（书位空间，可以是小数，拖拽时连续变化，不带上限） */
let logical = $state(0);
let reduced = $state(false);
/** 正在查看详情的书，null 表示弹窗关闭 */
let popBook = $state<ShelfBook | null>(null);

let raf = 0;
let wheelTimer: ReturnType<typeof setTimeout> | undefined;

const geo = $derived.by(() => {
	const w = clamp(width || 360, 240, 1700);
	// 所有尺寸共用的缩放系数：520 宽时正好是原实现的 1 倍
	const s = clamp(w / BASE_WIDTH, MIN_SCALE, MAX_SCALE);
	const cover = 128 * s;
	const spine = 18 * s;
	const pitch = 29 * s;
	const height = ((cover - 20 * s) * 166) / 118 + 54 * s;
	const footprint = spine + cover * DEPTH_X;
	const pull = cover * 0.84;
	const baseY = -cover * DEPTH_Y + height * 0.6 + 12 * s;
	// 弧线的最大下沉：正好在 RAIL_CLAMP 本书处
	const maxDrop = (RAIL_CLAMP * ROW_STEP + RAIL_CLAMP ** 2 * ROW_CURVE) * s;
	/**
	 * 舞台顶部的空档：焦点书被抬起 + 沿深度斜切，它的最高点会比原点高一截。
	 * 原实现把这截留白算进 rowHeight（下面还要放标题栏），我们不要标题栏，
	 * 直接把整排上移，书架就贴着卡片顶边。
	 */
	const headroom = Math.max(0, 0.252 * cover + 12 * s - 6);

	return {
		w,
		s,
		cover,
		spine,
		pitch,
		height,
		footprint,
		pull,
		pullX: pull * DEPTH_X,
		baseY,
		headroom,
		/**
		 * 弧线的「槽位数 → 屏幕距离」压缩比。
		 * 原实现视口最多 520（±6 本），我们的卡片更宽（±13 本），
		 * 不压缩的话 ±7 之外会拍成一条水平线。压缩后曲线正好铺满可见宽度。
		 */
		railK: Math.min(1, RAIL_CLAMP / (w / pitch / 2)),
		stageHeight: Math.round(
			baseY + height + maxDrop + 14 - headroom,
		),
		matSpine: "matrix(1,0.1,0,1,0,0)",
		matTop: `matrix(1,0.1,${DEPTH_X},${DEPTH_Y},0,0)`,
	};
});

/**
 * 聚焦度 0~1：正好在焦点上为 1，隔着一个身位（RADIUS）以外为 0。
 * 抽出的距离、抬起量都按它加权。
 */
function focusWeight(d: number): number {
	const distance = Math.abs(d);
	return distance >= RADIUS
		? 0
		: Math.cos((distance / RADIUS) * (Math.PI / 2)) ** 2;
}

/** 底部弧线：书底边相对「最高点」的下沉量（px），入参是「离中心几本书」 */
function railY(d: number): number {
	const c = clamp(d * geo.railK, -RAIL_CLAMP, RAIL_CLAMP);
	return (c * ROW_STEP + c * c * ROW_CURVE) * geo.s;
}

/** 书脊最多排几个字，再多就接一行省略号 */
const SPINE_MAX = 10;

/**
 * 书脊上只排正题：括号里的注释（全集 / 插图版 / 第2版…）连同括号一起去掉，
 * 中英文括号都认；整名都是括号时回退原文，免得书脊空白。
 */
function stripBrackets(title: string): string {
	const stripped = title
		.replace(/[（(][^）)]*[）)]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return stripped || title.trim();
}

/** 书脊上的书名：逐字一行竖排，超过 10 个字截断并以「…」收尾 */
function spineTitle(title: string): string {
	const glyphs = Array.from(stripBrackets(title));
	const shown =
		glyphs.length > SPINE_MAX
			? [...glyphs.slice(0, SPINE_MAX), "…"]
			: glyphs;
	return shown.join("\n");
}

type Slot = {
	/** 槽位号（整数，可正可负，书位空间里唯一且不变，同时用作 DOM key） */
	key: number;
	book: ShelfBook;
	/** 这本书在书架里的序号（1 起） */
	number: number;
	/** 离焦点的距离（书位，小数） */
	d: number;
	weight: number;
	x: number;
	y: number;
	focused: boolean;
	/** 离中心 1 本以内才load封面图，和原实现一致 */
	near: boolean;
	/** 落地阴影的六边形（舞台坐标） */
	floor: string;
};

const slots = $derived.by<Slot[]>(() => {
	const count = books.length;
	if (count === 0) return [];

	// 只有一本书时不做循环，就画它一个
	if (count === 1) return [buildSlot(0, 0, 0)];

	// 只渲染可能落进视口的槽位：两侧各留 2 个身位做缓冲，
	// 再多就是白白每帧重算（远处那些书肉眼也看不到）
	const span = Math.ceil(geo.w / geo.pitch / 2) + 2;
	const out: Slot[] = [];
	for (let key = Math.floor(logical) - span; key <= Math.ceil(logical) + span; key++) {
		out.push(buildSlot(key, key - logical, mod(key, count)));
	}
	return out;
});

/**
 * 算一本书的位置。d = 离焦点几本书（小数）。
 * 抽出量与抬起量都按聚焦度加权，和原实现一样：
 *   pull = pullDistance * w * (1.24 - .24w)，lift = w²(3-2w)
 */
function buildSlot(key: number, d: number, index: number): Slot {
	const g = geo;
	const weight = focusWeight(d);
	const pull = g.pull * weight * (1.24 - 0.24 * weight);
	const lift = weight * weight * (3 - 2 * weight);
	// 抽出后沿深度往观察者方向走：横向左偏 pull*depthX，纵向 +0.3*pull，再被 lift 抬起。
	// 书位基准线整体先右移 pullX（原实现的 start），抽出的那本再减回去，正好落在正中。
	const x =
		g.w / 2 - g.footprint / 2 + g.pullX + d * g.pitch - pull * DEPTH_X;
	const y =
		railY(d) + g.baseY - pull * DEPTH_Y - g.height * 0.6 * lift - g.headroom;

	// 落地阴影：锚在书位的静止位置（不含抽出量），沿深度铺一条薄片
	const sx = g.w / 2 - g.footprint / 2 + g.pullX + d * g.pitch;
	const sy = railY(d) + g.baseY + g.height - g.headroom;
	const depthX = g.cover * DEPTH_X;
	const depthY = g.cover * DEPTH_Y;
	const tilt = 1.4 * g.s;
	const lip = 10 * g.s;
	const floor = [
		[sx, sy],
		[sx + g.spine, sy + tilt],
		[sx + g.spine + depthX, sy + tilt + depthY],
		[sx + depthX, sy + depthY],
		[sx + depthX - lip, sy + depthY + lip],
		[sx - lip, sy + lip],
	]
		.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`)
		.join(" ");

	return {
		key,
		book: books[index],
		number: index + 1,
		d,
		weight,
		x,
		y,
		focused: Math.abs(d) < 0.5,
		near: Math.abs(Math.round(logical) - key) <= 1,
		floor,
	};
}

/** 当前焦点所在的整数书位 */
function scrollIndex(): number {
	return Math.round(logical);
}

// ---- 动画 ----
const settleCurve = cubicBezier(0.2, 1.06, 0.34, 1);

function stop() {
	cancelAnimationFrame(raf);
	raf = 0;
}

/** 用一条三次曲线把书位滑到目标（点到某本书 / 键盘 / 滚轮用） */
function animateTo(target: number) {
	stop();
	const from = logical;
	const span = target - from;
	if (reduced || Math.abs(span) < 0.0001) {
		logical = target;
		return;
	}
	const duration = 420;
	const start = performance.now();
	const tick = (now: number) => {
		const p = Math.min(1, (now - start) / duration);
		logical = from + span * settleCurve(p);
		if (p < 1) raf = requestAnimationFrame(tick);
		else raf = 0;
	};
	raf = requestAnimationFrame(tick);
}

/** 松手：走摩擦 + 落位两段物理 */
function release(velocity: number) {
	stop();
	if (reduced || books.length < 2) {
		logical = Math.round(logical);
		return;
	}
	const plan = planScroll(logical, velocity);
	const start = performance.now();
	const tick = (now: number) => {
		const t = (now - start) / 1000;
		logical = plan.at(Math.min(t, plan.duration));
		if (t < plan.duration) raf = requestAnimationFrame(tick);
		else {
			logical = Math.round(logical);
			raf = 0;
		}
	};
	raf = requestAnimationFrame(tick);
}

function step(delta: number) {
	animateTo(scrollIndex() + delta);
}

/** 滑到某一书位（点非中心书） */
function centreOn(key: number) {
	animateTo(key);
}

// ---- 拖拽 / 滚轮 / 键盘 ----
let drag: {
	x: number;
	from: number;
	moved: boolean;
	/** pointerdown 时命中的书（槽序号），用于区分「点击」和「拖拽」 */
	slotNo: number | null;
	/** 最近几帧的采样，用来算松手速度 */
	samples: Array<{ t: number; x: number }>;
} | null = null;
let suppressClick = false;
let lastDetent = 0;
let lastPulse = 0;
/** 拖拽中：给书加 GPU 提示，松手立刻撤掉，别让 30 层一直占显存 */
let dragging = $state(false);
/** 待应用的指针位置，合并到下一帧统一算 */
let pendingX: number | null = null;
let moveRaf = 0;

/** 把待处理的指针位置落到 logical 上（一帧最多一次） */
function applyPendingMove() {
	moveRaf = 0;
	if (!drag || pendingX === null) return;
	const x = pendingX;
	pendingX = null;
	logical = drag.from - (x - drag.x) / geo.pitch;
	detentPulse();
}

/** 收尾前把最后一帧补上，否则松手位置会差一帧 */
function flushPendingMove() {
	if (moveRaf) {
		cancelAnimationFrame(moveRaf);
		moveRaf = 0;
	}
	if (drag && pendingX !== null) {
		const x = pendingX;
		pendingX = null;
		logical = drag.from - (x - drag.x) / geo.pitch;
	}
}

/** 每跨过一个整数书位给一次轻震动（手机上才有，桌面无感） */
function detentPulse() {
	const lane = scrollIndex();
	if (lane === lastDetent) return;
	const now = performance.now();
	if (Math.abs(logical - lane) > 0.12 || now - lastPulse < 65) return;
	lastDetent = lane;
	lastPulse = now;
	navigator.vibrate?.(6);
}

function onPointerDown(event: PointerEvent) {
	if (event.pointerType === "mouse" && event.button !== 0) return;
	stop();
	const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(
		".shelf-book",
	);
	drag = {
		x: event.clientX,
		from: logical,
		moved: false,
		slotNo: el?.dataset.slot == null ? null : Number(el.dataset.slot),
		samples: [{ t: performance.now(), x: event.clientX }],
	};
	suppressClick = false;
	lastDetent = scrollIndex();
	// 这里**不能**立刻 setPointerCapture：指针捕获会把 pointerup 以及随后的 click
	// 一起重定向到舞台，书上的点击就永远收不到了。等真的开始拖再捕获。
}

function onPointerMove(event: PointerEvent) {
	if (!drag || books.length < 2) return;
	const dx = event.clientX - drag.x;
	if (!drag.moved && Math.abs(dx) > 3) {
		drag.moved = true;
		dragging = true;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}
	if (!drag.moved) return;

	// 速度采样必须逐条记（时间窗口只有 120ms），几何更新则合并到下一帧：
	// 高刷屏的 pointermove 一秒能来 200+ 次，没必要每次都重算整排书。
	const now = performance.now();
	drag.samples.push({ t: now, x: event.clientX });
	// 只留最近 120ms 的采样
	while (drag.samples.length > 2 && now - drag.samples[0].t > 120) {
		drag.samples.shift();
	}

	pendingX = event.clientX;
	if (!moveRaf) moveRaf = requestAnimationFrame(applyPendingMove);
}

/** 松手速度：取最近采样窗口的位移 / 时间，换算成「书位 / 秒」 */
function releaseVelocity(): number {
	if (!drag || drag.samples.length < 2) return 0;
	const first = drag.samples[0];
	const last = drag.samples[drag.samples.length - 1];
	const dt = (last.t - first.t) / 1000;
	if (dt <= 0.008) return 0;
	return -(last.x - first.x) / dt / geo.pitch;
}

function onPointerUp(event: PointerEvent) {
	if (!drag) return;
	// 先把还挂在 rAF 里的最后一帧落下去，松手位置才准
	flushPendingMove();
	const { moved, slotNo } = drag;
	const velocity = releaseVelocity();
	drag = null;
	dragging = false;
	if (moved) {
		suppressClick = true;
		release(velocity);
		setTimeout(() => {
			suppressClick = false;
		}, 0);
		return;
	}
	// 没有拖动 = 一次点击：命中哪本书就激活哪本
	if (slotNo === null) return;
	const hit = slots.find((item) => item.key === slotNo);
	if (hit) activateBook(hit, event);
}

/** 指针被系统收走（触摸滚动等）：只收尾，不算点击 */
function onPointerCancel() {
	if (!drag) return;
	flushPendingMove();
	const moved = drag.moved;
	const velocity = releaseVelocity();
	drag = null;
	dragging = false;
	if (moved) release(velocity);
}

/** 点一下书：非中心书先滑到中间，已经在中间的直接看详情 */
function activateBook(slot: Slot, event: MouseEvent | PointerEvent) {
	if (!slot.focused) {
		centreOn(slot.key);
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
		const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
		const delta = horizontal
			? event.deltaX
			: event.shiftKey
				? event.deltaY
				: 0;
		if (!delta) return;
		event.preventDefault();
		stop();
		logical += delta / (geo.pitch * 4);
		clearTimeout(wheelTimer);
		wheelTimer = setTimeout(() => release(delta / geo.pitch), 140);
	};
	stage?.addEventListener("wheel", onWheel, { passive: false });

	return () => {
		observer.disconnect();
		stage?.removeEventListener("wheel", onWheel);
		cancelAnimationFrame(raf);
		cancelAnimationFrame(moveRaf);
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
			class:is-dragging={dragging}
			bind:this={stage}
			style="height:{geo.stageHeight}px;--shelf-s:{geo.s.toFixed(3)}"
			role="listbox"
			tabindex="0"
			aria-label={openLabel}
			onkeydown={onKeydown}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerCancel}
		>
			<!-- 落地阴影：一张 svg 画完所有书，和原实现一样在所有书之前绘制 -->
			<svg class="shelf-floor" aria-hidden="true">
				<defs>
					<linearGradient id="shelf-floor-ink" x1="1" y1="0" x2="0" y2="1">
						<stop
							offset="0"
							stop-color="var(--shelf-floor)"
							stop-opacity="0.1"
						/>
						<stop
							offset="1"
							stop-color="var(--shelf-floor)"
							stop-opacity="0"
						/>
					</linearGradient>
				</defs>
				{#each slots as slot (slot.key)}
					<polygon points={slot.floor} fill="url(#shelf-floor-ink)" />
				{/each}
			</svg>

			{#each slots as slot (slot.key)}
				{@const no2 = String(slot.number).padStart(2, "0")}
				<a
					class="shelf-book"
					class:is-focused={slot.focused}
					href={slot.book.link}
					target="_blank"
					rel="noopener noreferrer"
					data-slot={slot.key}
					aria-label="{slot.book.title} · {slot.book.author} · {statusLabel(slot.book.status)}"
					aria-selected={slot.focused}
					role="option"
					style="transform:translate3d({slot.x.toFixed(2)}px,{slot.y.toFixed(2)}px,0)"
					onclick={(event) => onBookClick(event, slot)}
				>
					<span
						class="shelf-cover"
						style="width:{geo.cover.toFixed(2)}px;height:{geo.height.toFixed(2)}px;transform:matrix({DEPTH_X},{DEPTH_Y},0,1,{geo.spine.toFixed(2)},{(geo.spine * 0.1).toFixed(2)})"
					>
						{#if slot.near && slot.book.cover}
							<!-- 只有中心 ±1 本带图（最多 3 张），都在主视觉里，直接 eager 更划算 -->
							<img
								class="cover-art"
								src={slot.book.cover}
								alt=""
								loading="eager"
								fetchpriority={slot.focused ? "high" : "auto"}
								decoding="async"
								draggable="false"
								referrerpolicy="no-referrer"
							/>
						{:else}
							<span class="cover-blank">
								<Icon icon="material-symbols:menu-book" />
							</span>
						{/if}
					</span>

					<span
						class="shelf-top"
						style="width:{geo.spine.toFixed(2)}px;height:{geo.cover.toFixed(2)}px;transform:{geo.matTop}"
					></span>

					<span
						class="shelf-spine"
						style="width:{geo.spine.toFixed(2)}px;height:{geo.height.toFixed(2)}px;transform:{geo.matSpine}"
					>
						<span class="shelf-code spine-code">{no2}</span>
						<span class="spine-title">{spineTitle(slot.book.title)}</span>
						<span
							class="spine-dot"
							data-status={slot.book.status}
							title={statusLabel(slot.book.status)}
						></span>
					</span>
				</a>
			{/each}
		</div>

		<BookPop book={popBook} onClose={() => (popBook = null)} />
	{/if}
</div>
