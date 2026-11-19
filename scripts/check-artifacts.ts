/**
 * 构建产物检查（规范 §14.7）
 * ---------------------------------------------------------------------------
 * 最便宜的一层回归网：不启浏览器、不等渲染，秒级跑完，却能挡住一整类静默失败。
 *
 * 检查四件事（任一失败即退出码 1，CI 阻断）：
 *   1. Pagefind 索引非空 —— 索引 0 条时构建成功但搜索全空，最容易被漏掉；
 *   2. sitemap-index.xml 与 rss.xml 存在；
 *   3. 每页 og:image 非空，且指向本地文件时文件确实存在；
 *   4. 站内页面链接可达（跳过资源、API、rss/sitemap 这类非页面链接）。
 *
 * 用法：pnpm build 的 postbuild 末尾自动执行；也可单独 `npx tsx scripts/check-artifacts.ts`。
 */

import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const DIST = path.resolve("dist");
const errors: string[] = [];

async function walk(dir: string): Promise<string[]> {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const full = path.join(dir, entry.name);
			return entry.isDirectory() ? walk(full) : [full];
		}),
	);
	return files.flat();
}

if (!existsSync(DIST)) {
	console.error("[artifacts] dist/ 不存在，先运行 pnpm build");
	process.exit(1);
}

// 1. Pagefind 索引
const pagefindEntry = path.join(DIST, "pagefind/pagefind-entry.json");
if (!existsSync(pagefindEntry)) {
	errors.push("缺少 dist/pagefind/pagefind-entry.json（Pagefind 没跑？）");
} else {
	const entry = JSON.parse(await fs.readFile(pagefindEntry, "utf8")) as {
		languages?: Record<string, unknown>;
	};
	if (!entry.languages || Object.keys(entry.languages).length === 0) {
		errors.push("Pagefind 索引为空：构建成功但搜索会搜不到任何东西");
	}
}

// 2. sitemap / rss：存在且真的有内容（空 sitemap 与 404 的 og:image 一样，没人会发现）
for (const file of ["sitemap-index.xml", "rss.xml"]) {
	if (!existsSync(path.join(DIST, file))) errors.push(`缺少 dist/${file}`);
}
const sitemapChunk = path.join(DIST, "sitemap-0.xml");
if (existsSync(sitemapChunk)) {
	const xml = await fs.readFile(sitemapChunk, "utf8");
	if (!xml.includes("<loc>")) errors.push("sitemap-0.xml 里没有任何 <loc>");
	if (!xml.includes("/posts/"))
		errors.push("sitemap 里没有文章 URL（文章没被收录？）");
}
if (existsSync(path.join(DIST, "rss.xml"))) {
	const rss = await fs.readFile(path.join(DIST, "rss.xml"), "utf8");
	if (!rss.includes("<item>"))
		errors.push("rss.xml 里没有 <item>（订阅会是空的）");
}

// 3/4. 逐页检查
const htmlFiles = (await walk(DIST)).filter((file) => file.endsWith(".html"));
const pagePaths = new Set(
	htmlFiles.map(
		(file) =>
			`/${path
				.relative(DIST, file)
				.replace(/\\/g, "/")
				.replace(/index\.html$/, "")}`,
	),
);

const NON_PAGE_PREFIXES = ["/_astro/", "/pagefind/", "/api/", "/assets/"];
const NON_PAGE_FILES = new Set([
	"/rss.xml",
	"/atom.xml",
	"/sitemap-index.xml",
	"/sitemap-0.xml",
	"/robots.txt",
	"/llms.txt",
]);

function isPageLink(href: string): boolean {
	if (!href.startsWith("/") || href.startsWith("//")) return false;
	if (NON_PAGE_PREFIXES.some((prefix) => href.startsWith(prefix))) return false;
	if (NON_PAGE_FILES.has(href)) return false;
	// 带扩展名的基本是资源（pdf/zip/json 等），页面路径不带后缀
	return !/\.[a-z0-9]{1,8}$/i.test(href);
}

function normalize(href: string): string {
	const clean = href.split(/[?#]/)[0];
	return clean.endsWith("/") ? clean : `${clean}/`;
}

let checkedPages = 0;
let checkedLinks = 0;

for (const file of htmlFiles) {
	const html = await fs.readFile(file, "utf8");
	const rel = path.relative(DIST, file).replace(/\\/g, "/");
	checkedPages++;

	// Astro 的静态 redirect 会生成一个 meta refresh 桩页，没有 og:image 也没有正文
	if (/http-equiv=["']refresh["']/i.test(html)) continue;

	// Astro 的静态 redirect 会生成一个 meta refresh 桩页，没有 og:image 也没有正文
	if (/http-equiv=["']refresh["']/i.test(html)) continue;

	// noindex 页面（评论 iframe 之类）不要求分享卡片
	const noindex = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(
		html,
	);

	// og:image 非空
	const og = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]*)"/);
	if (!noindex && (!og || !og[1].trim())) {
		errors.push(`${rel}: og:image 为空`);
	} else if (og?.[1]?.trim()) {
		const url = og[1].trim();
		if (url.startsWith("/")) {
			const asset = path.join(DIST, url.split(/[?#]/)[0]);
			if (!existsSync(asset))
				errors.push(`${rel}: og:image 指向不存在的文件 ${url}`);
		}
	}

	// 站内页面链接
	for (const match of html.matchAll(/<a[^>]+href="([^"]+)"/g)) {
		const href = match[1];
		if (!isPageLink(href)) continue;
		checkedLinks++;
		if (!pagePaths.has(normalize(href))) {
			errors.push(`${rel}: 站内链接不可达 ${href}`);
		}
	}
}

if (errors.length > 0) {
	console.error(`[artifacts] ${errors.length} 处问题：`);
	for (const error of errors.slice(0, 40)) console.error(`  - ${error}`);
	if (errors.length > 40) console.error(`  …还有 ${errors.length - 40} 条`);
	process.exit(1);
}

console.log(
	`[artifacts] 通过：${checkedPages} 页、${checkedLinks} 条站内链接、og:image 与索引均正常`,
);
