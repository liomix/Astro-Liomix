/**
 * 文章排序：置顶优先 → 发布时间倒序 → id 正序兜底
 * ---------------------------------------------------------------------------
 * 单独抽出来是为了两件事：
 *   1. 它必须有唯一键。原先同一天的两篇比较时恒返回 1，排序结果不是全序 ——
 *      分页边界会随底层顺序漂移（同一篇文章可能在两页出现、或在两页都消失）；
 *   2. 它是纯函数，可以脱离 Astro 内容集合直接测（见 post-order.test.ts）。
 */

/** 排序只需要这三个字段，不绑定 `CollectionEntry`，方便测试与复用 */
export interface PostOrderKey {
	id: string;
	pinned?: boolean;
	published: Date | string;
}

function timeOf(value: Date | string): number {
	const t = value instanceof Date ? value.getTime() : Date.parse(value);
	// 日期缺失或非法时排到最后，不要因为一条坏数据让整列顺序变成随机
	return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

export function comparePostOrder(a: PostOrderKey, b: PostOrderKey): number {
	if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;

	const delta = timeOf(b.published) - timeOf(a.published);
	if (delta !== 0) return delta;

	// 同一天：用 id 正序做唯一键，保证结果稳定（等价于「文件名顺序」）
	return a.id.localeCompare(b.id);
}

/** 把任意带 id + frontmatter 的条目整理成排序键 */
export function toPostOrderKey(
	id: string,
	data: { pinned?: boolean; published: Date | string },
): PostOrderKey {
	return { id, pinned: data.pinned, published: data.published };
}
