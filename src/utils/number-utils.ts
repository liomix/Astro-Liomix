/**
 * 紧凑数字格式化：按中文习惯用「万」缩写，w 表示万。
 *
 * - 16404 → "1.6w"
 * - 10000 → "1w"（去掉多余的小数位）
 * - 1234567 → "123w"（十万级及以上保留整数，避免窄卡片溢出）
 * - 9999 → "9,999"（不足一万按千位分隔原样显示）
 */
export function formatCompactNumber(value: number): string {
	if (!Number.isFinite(value)) return "0";

	const abs = Math.abs(value);
	if (abs >= 10000) {
		const wan = value / 10000;
		const text =
			Math.abs(wan) >= 100
				? Math.round(wan).toString()
				: wan.toFixed(1).replace(/\.0$/, "");
		return `${text}w`;
	}

	return value.toLocaleString();
}
