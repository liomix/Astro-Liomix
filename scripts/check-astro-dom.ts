/**
 * 检查：`.astro` 的 <script> 里不许操作 DOM。
 * ---------------------------------------------------------------------------
 * 现状：31 个 .astro 用手写 DOM 做交互（querySelector / addEventListener / document.），
 * 这是「62 个 window.__xxxInit」的源头。存量不一次清干净，先**只拦新增**：
 * 每个文件允许的命中数记在 baselines/astro-dom.json，超了或出现新文件即失败。
 *
 * 用法：
 *   pnpm check:astro-dom          # 校验
 *   pnpm check:astro-dom --update # 认可当前状态（存量变更时才用，需在 PR 说明）
 */
import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

const SRC = "src";
const BASELINE = "scripts/baselines/astro-dom.json";
/** 交互相关的浏览器 API：出现在 .astro 的 <script> 里就算手写交互 */
const PATTERNS = [
	/\bquerySelector(All)?\s*\(/g,
	/\baddEventListener\s*\(/g,
	/\bdocument\s*\./g,
	/\bwindow\s*\.\s*(?!matchMedia)/g,
];

function countHits(code: string): number {
	return PATTERNS.reduce(
		(sum, re) => sum + (code.match(re)?.length ?? 0),
		0,
	);
}

async function main() {
	const update = process.argv.includes("--update");
	const files = await glob(`${SRC}/**/*.astro`);
	const current: Record<string, number> = {};

	for (const file of files) {
		const source = fs.readFileSync(file, "utf-8");
		const scripts = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
		const hits = scripts.reduce((sum, m) => sum + countHits(m[1]), 0);
		if (hits > 0) current[file.replace(/\\/g, "/")] = hits;
	}

	if (update) {
		fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
		fs.writeFileSync(
			BASELINE,
			`${JSON.stringify(current, null, "\t")}\n`,
			"utf-8",
		);
		console.log(
			`[astro-dom] 基线已更新：${Object.keys(current).length} 个文件`,
		);
		return;
	}

	const baseline: Record<string, number> = fs.existsSync(BASELINE)
		? JSON.parse(fs.readFileSync(BASELINE, "utf-8"))
		: {};

	const problems: string[] = [];
	for (const [file, hits] of Object.entries(current)) {
		const allowed = baseline[file] ?? 0;
		if (hits > allowed) {
			problems.push(`  ${file}  ${hits} 处（基线 ${allowed}）`);
		}
	}

	if (problems.length > 0) {
		console.error(
			"[astro-dom] 失败：.astro 的 <script> 里新增了 DOM 操作。交互请写成 .svelte 岛，用 onMount 做清理。",
		);
		console.error(problems.join("\n"));
		process.exit(1);
	}
	console.log(
		`[astro-dom] 通过：${Object.keys(current).length} 个存量文件，无新增`,
	);
}

void main();
