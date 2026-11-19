import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCompactNumber } from "./number";

test("一万以上用「万」缩写，且去掉多余的 .0", () => {
	assert.equal(formatCompactNumber(10000), "1w");
	assert.equal(formatCompactNumber(16404), "1.6w");
	assert.equal(formatCompactNumber(19999), "2w");
});

test("十万级及以上取整，避免窄卡片溢出", () => {
	assert.equal(formatCompactNumber(1234567), "123w");
	assert.equal(formatCompactNumber(100000), "10w");
});

test("不足一万保持原始数字（带千位分隔）", () => {
	assert.equal(formatCompactNumber(9999), (9999).toLocaleString());
	assert.equal(formatCompactNumber(0), (0).toLocaleString());
});

test("非法数值一律回退成 0，不显示 NaN", () => {
	assert.equal(formatCompactNumber(Number.NaN), "0");
	assert.equal(formatCompactNumber(Number.POSITIVE_INFINITY), "0");
});

test("负数走同一套规则，保留符号", () => {
	assert.equal(formatCompactNumber(-16404), "-1.6w");
});
