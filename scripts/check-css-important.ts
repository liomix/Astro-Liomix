/**
 * 检查：`!important` 不许再增长。
 * ---------------------------------------------------------------------------
 * 现状 522 处，是「两个模式抢同一个元素」的产物（沉浸阅读 vs 纯净模式抢 #left-sidebar）。
 * 一次性清完必然视觉回归，所以只锁上限：每个文件的计数记在 baselines/css-important.json，
 * 超了或新文件带 !important 即失败。降下来之后记得 --update 收紧基线。
 *
 * 用法：
 *   pnpm check:css          # 校验
 *   pnpm check:css --update # 收紧基线（只在成功删除 !important 之后）
 */
import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

const BASELINE = "scripts/baselines/css-important.json";

async function main() {
	const update = process.argv.includes("--update");
	const files = await glob("src/**/*.css");
	const current: Record<string, number> = {};

	for (const file of files) {
		const hits = (
			fs.readFileSync(file, "utf-8").match(/!important/g) ?? []
		).length;
		if (hits > 0) current[file.replace(/\\/g, "/")] = hits;
	}

	const total = Object.values(current).reduce((a, b) => a + b, 0);

	if (update) {
		fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
		fs.writeFileSync(
			BASELINE,
			`${JSON.stringify(current, null, "\t")}\n`,
			"utf-8",
		);
		console.log(`[css] 基线已更新：${total} 处 / ${Object.keys(current).length} 个文件`);
		return;
	}

	const baseline: Record<string, number> = fs.existsSync(BASELINE)
		? JSON.parse(fs.readFileSync(BASELINE, "utf-8"))
		: {};

	const problems: string[] = [];
	for (const [file, hits] of Object.entries(current)) {
		const allowed = baseline[file] ?? 0;
		if (hits > allowed) {
			problems.push(`  ${file}  ${hits} 处（上限 ${allowed}）`);
		}
	}

	if (problems.length > 0) {
		console.error(
			"[css] 失败：!important 增加。先查是不是两个模式在抢同一个元素——那是层序问题，不是优先级问题。",
		);
		console.error(problems.join("\n"));
		process.exit(1);
	}
	console.log(
		`[css] 通过：${total} 处 / ${Object.keys(current).length} 个文件，未超基线`,
	);
}

void main();
