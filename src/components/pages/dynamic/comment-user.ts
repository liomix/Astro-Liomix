/**
 * 评论者身份：昵称 + 邮箱，以及由它们推导出来的头像
 * ---------------------------------------------------------------------------
 * 静态站没有后端，身份只存在本地 localStorage（沿用点赞那套键名风格 firefly-*）。
 *
 * 头像**不单独存**：它永远由「邮箱 + 昵称」现算 ——
 *   1. 邮箱是 QQ 邮箱（qq.com / vip.qq.com / foxmail.com）且 @ 前是纯数字 →
 *      用腾讯官方的 qlogo 接口拿 QQ 头像；
 *   2. 其余情况（含非 QQ 邮箱、QQ 邮箱用了别名）→ 昵称首字。
 * 这样就不存在「改了昵称头像还是旧的」这种两份数据打架的情况。
 *
 * 这个模块只做纯数据，不碰 DOM：SSR 时被 import 也不会访问 window。
 */

/** localStorage 键，和 firefly-dynamic-likes 同一套命名 */
export const COMMENT_USER_STORAGE_KEY = "firefly-comment-user";

/** 昵称 / 邮箱的长度上限：够用，又能挡住把整段文本塞进来的情况 */
export const COMMENT_NAME_MAX = 24;
export const COMMENT_EMAIL_MAX = 64;

export interface CommentUser {
	name: string;
	email: string;
}

/**
 * 邮箱 → QQ 号。
 *
 * 只认这三种域名，且 @ 前必须全是数字（5–12 位，覆盖现有 QQ 号长度）：
 *   - qq.com         普通 QQ 邮箱
 *   - vip.qq.com     QQ 会员邮箱
 *   - foxmail.com    同属 QQ 邮箱体系
 * 会员邮箱如果设了英文别名，拿不到数字 QQ 号，这里返回 null，让调用方退回首字头像。
 */
export function qqFromEmail(email: string): string | null {
	const match = /^(\d{5,12})@(?:qq\.com|vip\.qq\.com|foxmail\.com)$/i.exec(
		email.trim(),
	);
	return match ? match[1] : null;
}

/**
 * QQ 号 → 头像地址。
 *
 * 用腾讯自己的 qlogo 接口（https://q1.qlogo.cn/g?b=sdk&nk=<QQ号>&s=<边长>），
 * 不引第三方 npm 包 —— 市面上的 qq-avatar 之类本质就是拼这个地址，
 * 多一层依赖不划算。s 支持 40 / 100 / 140 / 640，取 640 供 2 倍屏。
 */
export function qqAvatarUrl(qq: string, size = 640): string {
	return `https://q1.qlogo.cn/g?b=sdk&nk=${encodeURIComponent(qq)}&s=${size}`;
}

/**
 * 备用地址：主域名偶尔会被某些网络挡掉，qlogo 还有一条参数名不同的入口
 * （headimg_dl + spec），图片是同一张。只在主地址 onerror 时用一次。
 */
export function qqAvatarFallbackUrl(qq: string, size = 640): string {
	return `https://q.qlogo.cn/headimg_dl?dst_uin=${encodeURIComponent(qq)}&spec=${size}`;
}

/** 这个身份该用的头像地址；没有 QQ 头像时返回空串（调用方画首字彩圆） */
export function avatarUrlOf(
	user: Pick<CommentUser, "email"> | null | undefined,
): string {
	const qq = user?.email ? qqFromEmail(user.email) : null;
	return qq ? qqAvatarUrl(qq) : "";
}

/**
 * 昵称首字。
 * 用 Array.from 按码点切，避免把 emoji / 组合字符拆成半个代理对；
 * toUpperCase 对中文无效，但让拉丁昵称（liomix → L）看起来更像头像。
 */
export function initialOf(name: string): string {
	const chars = Array.from(name.trim());
	return (chars[0] ?? "?").toUpperCase();
}

/** 邮箱格式：只做「有且只有一个 @、域名带点」的最低限度判断，不追求 RFC 完整 */
export function isValidEmail(email: string): boolean {
	const value = email.trim();
	if (!value || value.length > COMMENT_EMAIL_MAX) return false;
	return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** 昵称是否可用：去空白后非空且不超长 */
export function isValidName(name: string): boolean {
	const value = name.trim();
	return value.length > 0 && value.length <= COMMENT_NAME_MAX;
}

/** 身份是否已经填完整：两条都有，才算可以参与评论 */
export function isCommentUserReady(
	user: CommentUser | null | undefined,
): boolean {
	return Boolean(
		user && isValidName(user.name) && isValidEmail(user.email),
	);
}

/** 读本地身份；没存过、解析失败、字段非法都当成「没有」 */
export function getCommentUser(): CommentUser | null {
	try {
		const raw = localStorage.getItem(COMMENT_USER_STORAGE_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return null;

		const { name, email } = parsed as Partial<CommentUser>;
		if (typeof name !== "string" || typeof email !== "string") return null;
		if (!isValidName(name) || !isValidEmail(email)) return null;

		return { name: name.trim(), email: email.trim() };
	} catch {
		return null;
	}
}

/** 写本地身份；顺带派发 commentUserChange，方便以后接后端时统一监听 */
export function setCommentUser(user: CommentUser): void {
	const next: CommentUser = {
		name: user.name.trim().slice(0, COMMENT_NAME_MAX),
		email: user.email.trim().slice(0, COMMENT_EMAIL_MAX),
	};
	try {
		localStorage.setItem(COMMENT_USER_STORAGE_KEY, JSON.stringify(next));
	} catch {
		// 隐私模式下写入会抛错，身份只在本次页面内有效，不影响流程
	}
	window.dispatchEvent(
		new CustomEvent<CommentUser>("commentUserChange", { detail: next }),
	);
}

/** 清掉本地身份（设置面板或调试用，目前没有入口） */
export function clearCommentUser(): void {
	try {
		localStorage.removeItem(COMMENT_USER_STORAGE_KEY);
	} catch {
		// 同上，读不到就当没有
	}
}
