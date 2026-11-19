/**
 * 首屏 JS 预算检查
 * ---------------------------------------------------------------------------
 * 只统计「页面 HTML 直接引用」的 script / modulepreload —— 也就是首屏一定会下载的那批，
 * 不含按需 import 的 chunk（lottie、echarts 这些本来就该晚到）。
 *
 * 超预算时退出码 1，CI 直接红；本地跑 `pnpm check:budget` 也能看明细。
 */
import fs from "node:fs";
import path from "node:path";

/** 首屏 JS 原始体积上限（KB）。改这个值请顺手在 PR 里说明原因 */
const BUDGET_KB = 140;
/** 只看这几页的首屏；首页通常最重 */
const PAGES = ["dist/index.html", "dist/posts/firefly/index.html"];

interface Entry {
	page: string;
	file: string;
	bytes: number;
}

function parseRefs(html: string): string[] {
	const refs = new Set<string>();
	for (const re of [
		/<script[^>]+src="(\/_astro\/[^"]+\.js)"/g,
		/<link[^>]+rel="modulepreload"[^>]+href="(\/_astro\/[^"]+\.js)"/g,
	]) {
		let m = re.exec(html);
		while (m) {
			refs.add(m[1]);
			m = re.exec(html);
		}
	}
	return [...refs];
}

const rows: Entry[] = [];
for (const page of PAGES) {
	if (!fs.existsSync(page)) {
		console.error(`[budget] 找不到 ${page}，先跑 pnpm build`);
		process.exit(1);
	}
	const html = fs.readFileSync(page, "utf8");
	for (const ref of parseRefs(html)) {
		const file = path.join("dist", ref.replace(/^\//, ""));
		if (!fs.existsSync(file)) continue;
		rows.push({ page, file: ref, bytes: fs.statSync(file).size });
	}
}

const worst = new Map<string, number>();
for (const r of rows) {
	worst.set(r.page, (worst.get(r.page) ?? 0) + r.bytes);
}

console.log("[budget] 首屏 JS（原始体积）：");
for (const [page, bytes] of [...worst].sort((a, b) => b[1] - a[1])) {
	console.log(`  ${page.padEnd(34)} ${(bytes / 1024).toFixed(1)} KB`);
}

const heaviest = Math.max(...worst.values(), 0);
const kb = heaviest / 1024;
if (kb > BUDGET_KB) {
	console.error(`\n[budget] 超预算：${kb.toFixed(1)} KB > ${BUDGET_KB} KB`);
	console.error("[budget] 明细（最大的 8 个）：");
	for (const r of rows.sort((a, b) => b.bytes - a.bytes).slice(0, 8)) {
		console.error(
			`    ${(r.bytes / 1024).toFixed(1).padStart(6)} KB  ${r.file}`,
		);
	}
	process.exit(1);
}
console.log(`\n[budget] 通过：${kb.toFixed(1)} KB / ${BUDGET_KB} KB`);
