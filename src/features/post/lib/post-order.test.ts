import assert from "node:assert/strict";
import { test } from "node:test";
import { comparePostOrder, type PostOrderKey } from "./post-order";

const post = (id: string, published: string, pinned = false): PostOrderKey => ({
	id,
	published,
	pinned,
});

test("置顶优先，无论时间早晚", () => {
	const pinnedOld = post("old", "2020-01-01", true);
	const fresh = post("new", "2026-01-01");
	assert.ok(comparePostOrder(pinnedOld, fresh) < 0);
	assert.ok(comparePostOrder(fresh, pinnedOld) > 0);
});

test("同为非置顶时按发布时间倒序", () => {
	const older = post("a", "2025-01-01");
	const newer = post("b", "2025-06-01");
	assert.ok(comparePostOrder(newer, older) < 0);
	assert.ok(comparePostOrder(older, newer) > 0);
});

test("同一天必须给出唯一的全序（曾经的 bug：恒返回 1）", () => {
	const a = post("alpha", "2026-11-17T10:00:00+08:00");
	const b = post("beta", "2026-11-17T10:00:00+08:00");

	// 反对称：交换参数必须变号，否则排序结果依赖底层顺序
	assert.equal(comparePostOrder(a, b), -comparePostOrder(b, a));
	assert.notEqual(comparePostOrder(a, b), 0);
	// id 正序兜底
	assert.ok(comparePostOrder(a, b) < 0);
});

test("排序结果与输入顺序无关", () => {
	const list = [
		post("c", "2026-01-01"),
		post("a", "2026-11-17"),
		post("b", "2026-11-17"),
		post("p", "2020-01-01", true),
	];
	const once = [...list].sort(comparePostOrder).map((p) => p.id);
	const twice = [...list]
		.reverse()
		.sort(comparePostOrder)
		.map((p) => p.id);
	assert.deepEqual(once, twice);
	assert.deepEqual(once, ["p", "a", "b", "c"]);
});

test("日期缺失/非法时排到最后，不污染其余顺序", () => {
	const broken = post("broken", "not-a-date");
	const normal = post("normal", "2026-01-01");
	assert.ok(comparePostOrder(normal, broken) < 0);
	assert.ok(comparePostOrder(broken, normal) > 0);
});
