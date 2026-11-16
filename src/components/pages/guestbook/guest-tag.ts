/**
 * 留言墙的便签数据与配色
 * ---------------------------------------------------------------------------
 * 单独放一个模块，是因为便签（GuestTag）和墙（GuestbookWall）都要用：
 * 墙负责取数、点赞、删除，便签只负责把一条数据画出来。
 * 纯函数，不碰 DOM，SSR 时被 import 也没事。
 */

/** 墙上一张便签（GuestTag 的数据） */
export type GuestTagItem = {
	id: string;
	body: string;
	createdAt: string;
	/**
	 * 预格式化的日期。Intl.DateTimeFormat 构造很贵，而每次点赞都会重建
	 * Note 数组 —— 在渲染里现算等于每条留言每帧 new 一次 formatter。
	 */
	dateLabel: string;
	author: string;
	isOwner: boolean;
	/** 同页里挂在它下面的回复数（只统计这一页能看到的） */
	replies: number;
	likes: number;
	liked: boolean;
	/** 这台设备发过、且还留着撤回凭据 —— 只有这种才显示 × */
	mine: boolean;
	/**
	 * 还没过审（后端默认 pending）。
	 * 列表接口只回 approved，所以这个字段只对自己刚发的那条成立：
	 * 让它先上墙并标出来，否则「发完什么都没发生」比待审核更难理解。
	 */
	pending: boolean;
};

/** 便签底色有几种（与 GuestTag 里的 data-tone 规则一一对应） */
export const GUEST_TAG_TONES = 7;

/**
 * 这条留言在点赞服务里的 slug。
 *
 * 评论不是文章，但点赞接口是按 post slug 存的，所以借一个前缀把留言也塞进
 * 同一张表：`guestbook-<评论 id>`。写在一处，避免墙和便签各算一遍。
 */
export function likeSlugOfGuestTag(id: string): string {
	return `guestbook-${id}`;
}

/**
 * 便签底色（0 – GUEST_TAG_TONES-1）。
 *
 * 按 id 哈希而不是按数组下标：下标会随着「发一条插到最前 / 删一条 / 加载更多」
 * 整体位移，整墙颜色跟着洗牌 —— 用户看到的是「我的留言一提交，别人的便签也变了」。
 * 哈希到 id 上，颜色就是这条留言的属性，插入删除都只影响它自己。
 * 用 FNV-1a：够短、无依赖，和头像渐变那套是同一个思路。
 */
export function toneOfGuestTag(id: string): number {
	let hash = 2166136261;
	for (let i = 0; i < id.length; i++) {
		hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
	}
	return (hash >>> 0) % GUEST_TAG_TONES;
}
