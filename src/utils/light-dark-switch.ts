/**
 *   主题切换：圆形发散 / 收敛（View Transitions API）。
 *
 *
 *   切到夜间 —— 动画 `::view-transition-new(root)`（暗色快照）从图标位置 0 扩到满圆，
 *               黑色从图标发散出去。500ms
 *   切到日间 —— 动画 `::view-transition-old(root)`（暗色快照）从满圆缩到 0，
 *               旧层抬到最上面，黑色收束回图标、露出下面的亮色。600ms
 *
 * 时长与缓动为 tweb 的 `Transitions.standard`（easing cubic-bezier(.4,0,.2,1)，
 * duration {true:300,false:250}，调用处再乘 2）。
 *
 * 过渡期间浏览器只合成两张静止快照，页面本身不重绘，因此比「全站元素各自跑
 * transition-colors」流畅得多；不支持 View Transitions 或用户要求减少动效时
 * 直接应用主题，退化为瞬时切换。
 */

export interface ThemeTransitionOrigin {
	x: number;
	y: number;
}

interface ThemeViewTransition {
	ready: Promise<void>;
	finished: Promise<void>;
	/** 过渡卡住时强制结束（安全网用） */
	skipTransition?: () => void;
}

type StartViewTransition = (callback: () => void) => ThemeViewTransition;

/** 与 tweb 一致：cubic-bezier(.4, .0, .2, 1) */
const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
/** tweb: standard.duration.false(250) * 2 —— 切到夜间，亮色收敛 */
const DURATION_TO_DARK_MS = 500;
/** tweb: standard.duration.true(300) * 2 —— 切到日间，亮色发散 */
const DURATION_TO_LIGHT_MS = 600;

/** 揭示轮次：连续点击时旧过渡的回调不能影响新一轮 */
let revealGeneration = 0;

function getStartViewTransition(): StartViewTransition | null {
	if (typeof document === "undefined") return null;

	// 用 unknown 中转：部分 TS 版本的 lib.dom 已内置 startViewTransition，
	// 直接交叉类型会和内置签名冲突。
	const doc = document as unknown as {
		startViewTransition?: StartViewTransition;
	};
	const candidate = doc.startViewTransition;

	return typeof candidate === "function" ? candidate.bind(document) : null;
}

function prefersReducedMotion(): boolean {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

/** 取元素中心作为揭示圆心；元素不可见时返回 undefined（退回默认右下角） */
export function originFromElement(
	element: Element | null | undefined,
): ThemeTransitionOrigin | undefined {
	if (!(element instanceof HTMLElement)) return undefined;

	const rect = element.getBoundingClientRect();
	if (rect.width === 0 && rect.height === 0) return undefined;

	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * 生成 `circle()` 值。
 *
 * 半径与圆心一律用百分比表达（tweb 的做法）：某些 Chromium 版本对快照层做
 * 合成裁剪时会按 backing-store 像素解析 `px`，导致圆心偏到 1/DPR 处；百分比是
 * 相对盒子自身解析的，任何 DPR 下都落在点击位置。
 * 圆的百分比半径按盒子对角线 / √2 解析，所以要反算。
 */
function circleValue(
	x: number,
	y: number,
	radius: number,
	boxWidth: number,
	boxHeight: number,
): string {
	if (boxWidth > 0 && boxHeight > 0) {
		const percent =
			(radius / Math.hypot(boxWidth, boxHeight)) * Math.SQRT2 * 100;
		return `circle(${percent}% at ${(x / boxWidth) * 100}% ${(y / boxHeight) * 100}%)`;
	}
	return `circle(${radius}px at ${x}px ${y}px)`;
}

/**
 * 执行主题切换；origin 缺省时以视口右下角（主题按钮附近）为圆心。
 * apply 里应包含所有会改变画面的操作（改 class / data-theme / 事件广播），
 * 它们会被拍进「新主题」快照。
 */
export function runThemeReveal(
	apply: () => void,
	options: { origin?: ThemeTransitionOrigin; toDark: boolean },
): void {
	const start = getStartViewTransition();

	if (!start || prefersReducedMotion()) {
		apply();
		return;
	}

	const root = document.documentElement;
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const x = options.origin?.x ?? viewportWidth - 24;
	const y = options.origin?.y ?? viewportHeight - 24;

	// 变暗时动画跑在「新」快照（暗色）上，新层默认就在旧层之上，不用调层级；
	// 变亮时动画跑在「旧」快照（暗色）上，得把旧层抬到最上面才看得见收敛。
	// 两向都显式写一次，免得连点导致上一轮的值残留。
	root.style.setProperty("--theme-vt-old-z", options.toDark ? "auto" : "2");

	// 连续点击时浏览器会丢弃上一轮过渡，旧过渡的 finished 回调不能去动新一轮写下的值
	const generation = ++revealGeneration;

	// 下面这段必须在 start() 之前做完：两个快照都要在没有过渡的状态下拍摄。
	// theme-reveal 掐掉全站过渡（见 light-dark-switch.css），事件用来让
	// 全屏波浪 canvas 这类每帧重绘的组件临时停手。
	root.classList.add("theme-reveal");
	window.dispatchEvent(new CustomEvent("theme-reveal-start"));

	const duration = options.toDark ? DURATION_TO_DARK_MS : DURATION_TO_LIGHT_MS;
	let done = false;
	let safetyTimer: ReturnType<typeof setTimeout> | undefined;

	function finish() {
		if (done) return;
		done = true;
		if (safetyTimer !== undefined) clearTimeout(safetyTimer);
		// 已经有更新一轮的揭示接管了，别把它写下的状态清掉
		if (generation !== revealGeneration) return;
		root.classList.remove("theme-reveal");
		root.style.removeProperty("--theme-vt-old-z");
		window.dispatchEvent(new CustomEvent("theme-reveal-end"));
	}

	let transition: ThemeViewTransition;
	try {
		transition = start(apply);
	} catch {
		// 浏览器拒绝开启（例如已有过渡在跑），直接切
		finish();
		apply();
		return;
	}

	// 安全网：万一过渡没正常收尾，theme-reveal 会永久留在 html 上，
	// 全站过渡被禁用、波浪也停着。到点强制结束。
	safetyTimer = setTimeout(() => {
		try {
			transition.skipTransition?.();
		} catch {
			// 已经结束的过渡再 skip 会抛，忽略
		}
		finish();
	}, duration + 800);

	// 变暗：动画新层（暗色）从 0 扩到满 —— 黑色从图标发散出去
	// 变亮：动画旧层（暗色）从满缩到 0 —— 黑色收束回图标
	const pseudoElement = options.toDark
		? "::view-transition-new(root)"
		: "::view-transition-old(root)";

	transition.ready
		.then(() => {
			// 用快照层自身的盒子算百分比；取不到（0 或 NaN）时退回视口尺寸
			const box = getComputedStyle(root, pseudoElement);
			const measuredWidth = Number.parseFloat(box.width);
			const measuredHeight = Number.parseFloat(box.height);
			const hasBox =
				Number.isFinite(measuredWidth) &&
				Number.isFinite(measuredHeight) &&
				measuredWidth > 0 &&
				measuredHeight > 0;
			const boxWidth = hasBox ? measuredWidth : viewportWidth;
			const boxHeight = hasBox ? measuredHeight : viewportHeight;

			// 覆盖整屏所需半径：圆心到最远角的距离
			const radius = Math.hypot(
				Math.max(x, boxWidth - x),
				Math.max(y, boxHeight - y),
			);

			const opened = circleValue(x, y, radius, boxWidth, boxHeight);
			const closed = circleValue(x, y, 0, boxWidth, boxHeight);

			root.animate(
				// 变暗：圆 0 → 满（发散）；变亮：圆 满 → 0（收敛）
				{ clipPath: options.toDark ? [closed, opened] : [opened, closed] },
				{
					duration,
					easing: EASING,
					pseudoElement,
					// 不留这一笔，动画结束的瞬间会闪一下原样
					fill: "forwards",
				} as KeyframeAnimationOptions & { pseudoElement: string },
			);
		})
		.catch(() => {
			// 过渡被跳过（连续点击时浏览器会丢弃前一个），无需处理
		})
		.finally(() => {
			transition.finished.finally(finish);
		});
}
