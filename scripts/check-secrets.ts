/**
 * 构建产物密钥泄漏检查
 * ----------------------------------------------------------------------------
 * 微信读书的 API Key 只能在构建期由服务端使用，绝对不能出现在 dist 里。
 * 这里在 astro build 之后扫一遍产物，命中就返回非 0 让 CI / 本地构建失败：
 *   1. 环境变量 / wereadConfig.apiKey 里的 Key 原文
 *   2. 形如 wrk-xxxxxxxx 的 Key 形态（防止有人把 Key 写进 Markdown / 前端脚本）
 *   3. WEREAD_API_KEY 这个变量名（说明有代码在把私密变量往客户端搬）
 *
 * 只扫文本类文件，且跳过 > 2MB 的大文件，速度可以接受。
 */
import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const DIST = "dist";
const CONFIG_FILE = "src/config/wereadConfig.ts";
const TEXT_EXT = new Set([
	".html",
	".htm",
	".js",
	".mjs",
	".cjs",
	".css",
	".json",
	".xml",
	".txt",
	".svg",
	".map",
	".webmanifest",
]);
/** 单个文件超过这个大小就不扫了（一般是数据文件，没必要逐字比对） */
const MAX_SIZE = 2 * 1024 * 1024;
/** 微信读书 Key 的形态：wrk- 加一长串字符 */
const KEY_SHAPE = /wrk-[A-Za-z0-9_-]{20,}/;

interface Leak {
	file: string;
	reason: string;
}

/** 收集「不该出现」的字符串：环境变量 + 配置文件里硬编码的 Key */
async function collectSecrets(): Promise<string[]> {
	const secrets = new Set<string>();

	const fromEnv = process.env.WEREAD_API_KEY?.trim();
	if (fromEnv) secrets.add(fromEnv);

	try {
		const config = await fs.readFile(CONFIG_FILE, "utf-8");
		const hit = config.match(/apiKey:\s*["'`]([^"'`]+)["'`]/);
		const fromConfig = hit?.[1]?.trim();
		if (fromConfig) secrets.add(fromConfig);
	} catch {
		// 没有配置文件时只查环境变量
	}

	return [...secrets];
}

/** 打码输出，万一真的泄漏了也别把 Key 再抄进 CI 日志 */
function mask(secret: string): string {
	if (secret.length <= 8) return "***";
	return `${secret.slice(0, 5)}***${secret.slice(-2)}`;
}

async function walk(dir: string): Promise<string[]> {
	const out: string[] = [];
	let entries: Dirent[];
	try {
		entries = await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...(await walk(full)));
		} else if (TEXT_EXT.has(path.extname(entry.name).toLowerCase())) {
			out.push(full);
		}
	}
	return out;
}

async function main(): Promise<void> {
	const files = await walk(DIST);
	if (files.length === 0) {
		console.error(`[secret-check] 没有找到构建产物，先跑 astro build 再检查（${DIST}/）`);
		process.exit(1);
	}

	const secrets = await collectSecrets();
	if (secrets.length === 0) {
		console.warn(
			"[secret-check] 未配置 WEREAD_API_KEY，只做 Key 形态检查（wrk-…）",
		);
	}

	const leaks: Leak[] = [];

	for (const file of files) {
		let text: string;
		try {
			const stat = await fs.stat(file);
			if (stat.size > MAX_SIZE) continue;
			text = await fs.readFile(file, "utf-8");
		} catch {
			continue;
		}

		for (const secret of secrets) {
			if (text.includes(secret)) {
				leaks.push({ file, reason: `API Key 原文（${mask(secret)}）` });
			}
		}

		if (KEY_SHAPE.test(text)) {
			leaks.push({ file, reason: "疑似 API Key（wrk- 形态）" });
		}

		if (text.includes("WEREAD_API_KEY")) {
			leaks.push({ file, reason: "私密变量名 WEREAD_API_KEY 被打进了客户端" });
		}
	}

	if (leaks.length === 0) {
		console.log(
			`[secret-check] 通过：扫了 ${files.length} 个产物文件，没有发现密钥泄漏`,
		);
		return;
	}

	console.error("[secret-check] 构建产物里发现密钥泄漏，已中止：");
	for (const leak of leaks) {
		console.error(`  - ${leak.file}：${leak.reason}`);
	}
	console.error(
		[
			"",
			"修复建议：",
			"  1. 私密变量不要加 PUBLIC_ 前缀，也不要 import 到 client: 组件里；",
			"  2. 需要前端用的数据请在服务端（frontmatter / 接口）处理后再传；",
			"  3. 如果 Key 已经进过远端产物，去 https://weread.qq.com/r/weread-skills 重置它。",
		].join("\n"),
	);
	process.exit(1);
}

await main();
