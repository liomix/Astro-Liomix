/**
 * 检查：自定义事件名不许裸写字符串。
 * ---------------------------------------------------------------------------
 * 现状：52 个裸事件名（"sakuraToggle"、"password:decrypted"…），改名后不知道谁在听。
 * 目标：全部收进 `shared/lib/runtime/events.ts` 常量表，用 EVENTS.x 派发。
 *
 * 存量不一次清完，先**只拦新增**：现有字面量记在 baselines/event-names.json。
 * 用法：
 *   pnpm check:events          # 校验
 *   pnpm check:events --update # 认可当前状态
 */
import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

const BASELINE = "scripts/baselines/event-names.json";
/** new CustomEvent("x") / CustomEvent("x") 的字面量形式 */
const LITERAL_EVENT = /new\s+CustomEvent\s*\(\s*["']([^"']+)["']/g;

async function main() {
	const update = process.argv.includes("--update");
	const files = [
		...(await glob("src/**/*.{ts,astro,svelte}")),
		...(await glob("scripts/**/*.ts")),
	];

	const found = new Map<string, string[]>();
	for (const file of files) {
		const source = fs.readFileSync(file, "utf-8");
		for (const m of source.matchAll(LITERAL_EVENT)) {
			const name = m[1];
			const list = found.get(name) ?? [];
			list.push(file.replace(/\\/g, "/"));
			found.set(name, list);
		}
	}

	const current = Object.fromEntries(
		[...found.entries()].sort(([a], [b]) => a.localeCompare(b)),
	);

	if (update) {
		fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
		fs.writeFileSync(
			BASELINE,
			`${JSON.stringify(current, null, "\t")}\n`,
			"utf-8",
		);
		console.log(`[events] 基线已更新：${found.size} 个事件名`);
		return;
	}

	const baseline: Record<string, string[]> = fs.existsSync(BASELINE)
		? JSON.parse(fs.readFileSync(BASELINE, "utf-8"))
		: {};

	const problems = [...found.keys()]
		.filter((name) => !(name in baseline))
		.map((name) => `  "${name}"  ← ${found.get(name)?.join(", ")}`);

	if (problems.length > 0) {
		console.error(
			"[events] 失败：新增了裸事件名字符串。请先在 src/shared/lib/runtime/events.ts 定义常量，再用 EVENTS.x 派发。",
		);
		console.error(problems.join("\n"));
		process.exit(1);
	}
	console.log(`[events] 通过：${found.size} 个存量事件名，无新增`);
}

void main();
