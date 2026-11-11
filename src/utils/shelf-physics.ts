/**
 * 书架横向滚动的松手物理 —— 移植自 Wenku8_Flutter 的 ArchiveScrollSimulation。
 * ----------------------------------------------------------------------------
 * 松手后分两段：先按指数摩擦滑行，再沿三次曲线精确落到最近的整数书位。
 * 两段共用同一个位置与速度，所以「松手」不会变成一次新的、突兀的居中动画，
 * 甩一下会在目标书位上自然停住，既不回弹也不冲过头。
 *
 * 单位统一是「书位」：1 = 一本书的间距，速度 = 书位 / 秒。
 */

/** 摩擦衰减率：速度 e^-4.4 每秒，终末位移 = v / 4.4 */
const DRAG = 4.4;
/** 落位弹簧的角频率（rad/s），越大收得越快 */
const OMEGA = 12;
/** 低于这个速度视为「没甩」，直接落回最近的整数位 */
const MIN_VELOCITY = 1.2;
/** 摩擦段交接到落位段的速度阈值（书位/秒） */
const HANDOFF = 4;

export interface ScrollPlan {
	/** 整段动画时长（秒） */
	duration: number;
	/** t 秒时的位置（书位） */
	at: (t: number) => number;
}

/**
 * 按松手时的位置与速度，算出这一甩该落在哪、以及每一时刻走到哪。
 */
export function planScroll(position: number, velocity: number): ScrollPlan {
	const v = Number.isFinite(velocity) ? velocity : 0;
	const flung = Math.abs(v) >= MIN_VELOCITY;
	const release = flung ? v : 0;

	// 先按「摩擦走完的终点」估一个整数书位
	let target = Math.round(position + release / DRAG);

	// 真甩动要么落在前面，要么别冲过头再倒回来：给出足够的滑行跑道
	if (
		flung &&
		(target - position) * Math.sign(release) <
			Math.abs(release) / OMEGA
	) {
		const runway = position + release / OMEGA;
		target =
			release > 0 ? Math.ceil(runway) : Math.floor(runway);
	}

	const speed = Math.abs(release);
	const coast =
		flung && speed > HANDOFF ? Math.log(speed / HANDOFF) / DRAG : 0;

	const slide = (t: number) =>
		position + (release * (1 - Math.exp(-DRAG * t))) / DRAG;
	const slideV = (t: number) => release * Math.exp(-DRAG * t);

	const handoffPosition = slide(coast);
	const handoffVelocity = slideV(coast);
	const landing =
		flung && Math.abs(handoffVelocity) > 0.25
			? (3 * (target - handoffPosition)) / handoffVelocity
			: 0;

	if (!(landing > 0)) {
		// 没甩动（或交接速度太小）：临界阻尼弹簧，从当前位置平滑滑到整数位
		const delta = target - position;
		const at = (t: number) =>
			target - delta * (1 + OMEGA * t) * Math.exp(-OMEGA * t);
		return { duration: 0.56, at };
	}

	const at = (t: number) => {
		if (t < coast) return slide(t);
		// 三次曲线：起始速度就是交接速度，落到书位时速度与加速度都归零
		const remain = Math.min(1, Math.max(0, 1 - (t - coast) / landing));
		return target - (target - handoffPosition) * remain ** 3;
	};

	return { duration: coast + landing, at };
}

/**
 * 三次贝塞尔缓动，返回 t → 进度 的函数（和 CSS cubic-bezier 等价）。
 * 用于「点一本书让它滑到中间」那段，原实现用 Cubic(.2, 1.06, .34, 1)（略带过冲）。
 */
export function cubicBezier(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
): (t: number) => number {
	const cx = 3 * x1;
	const bx = 3 * (x2 - x1) - cx;
	const ax = 1 - cx - bx;
	const cy = 3 * y1;
	const by = 3 * (y2 - y1) - cy;
	const ay = 1 - cy - by;

	const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
	const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
	const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

	return (x: number) => {
		if (x <= 0) return 0;
		if (x >= 1) return 1;
		// 牛顿迭代求 t，退化时退回二分
		let t = x;
		for (let i = 0; i < 6; i++) {
			const d = slopeX(t);
			if (Math.abs(d) < 1e-4) break;
			const next = t - (sampleX(t) - x) / d;
			if (next < 0 || next > 1) break;
			t = next;
		}
		let lo = 0;
		let hi = 1;
		for (let i = 0; i < 20 && Math.abs(sampleX(t) - x) > 1e-4; i++) {
			if (sampleX(t) < x) lo = t;
			else hi = t;
			t = (lo + hi) / 2;
		}
		return sampleY(t);
	};
}
