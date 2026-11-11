/**
 * 微信读书网关的本地缓存（仅服务端 / 构建期使用）
 * ----------------------------------------------------------------------------
 * 为什么要缓存：
 *   一次完整的图书页构建会打 1 次 shelf/sync + 2~3 次 readdata/detail + 每年 1 次
 *   年度统计，再给每本书补 2 个请求。书架有 30 本时就是 60+ 个请求；dev 模式下
 *   每次刷新页面都会重跑 frontmatter，等于反复薅同一份数据，很容易触发网关限流
 *   甚至把 Key 撸封。所以这里做四层保护：
 *
 *   1. 内存缓存  —— 同一进程内的重复调用（dev 的每次请求、构建里的重复调用）直接命中
 *   2. 磁盘缓存  —— cache/weread/<api>-<hash>.json，跨进程、跨构建复用，TTL 按接口分档
 *   3. 陈旧兜底  —— 抓取失败（超时 / 429 / errcode）时继续用过期缓存，最多 staleDays
 *   4. 冷却窗口  —— 被网关拒绝后写 _cooldown.json，冷却期内干脆不发请求，避免越封越久
 *
 * 想「立刻更新数据」：跑 `pnpm books:refresh`（入口在本文件末尾），它会删掉会变的那部分
 * 缓存并写一个 _refresh 标记；这里读到标记就丢掉内存缓存 + 跳过冷却，所以正在跑的
 * dev server 不用重启，下一次请求就是新数据。要发布则再 `pnpm build`
 * （或 `books:refresh:all` 连书籍详情一起清）。
 *
 * 安全：
 *   - 缓存里只存响应体，**不存请求头**，API Key 永远不落盘
 *   - 文件 0o600、原子写（tmp + rename），并发构建不会写出半个 JSON
 *   - 目录 cache/ 已被 .gitignore 忽略
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** 默认缓存目录：项目根的 cache/weread（已 gitignore） */
export const DEFAULT_CACHE_DIR = path.join(PROJECT_ROOT, "cache", "weread");

/** 被网关拒绝后暂停多久（秒），避免「越试越封」 */
const DENIED_COOLDOWN = 15 * 60;

/** 「立刻更新」标记文件：由 clearWereadCache() 写入 */
const REFRESH_MARKER = "_refresh";
/** 冷却标记文件 */
const COOLDOWN_FILE = "_cooldown.json";
/** 会变的数据：书架 + 阅读统计（含年度热力图）。书籍详情几乎不变，默认保留 */
const VOLATILE = /^(shelf-sync|readdata)-/;

/** 网关结果：value 为 null 表示这次没拿到；denied 表示被限流 / 拒绝 */
export interface FetchOutcome<T> {
	value: T | null;
	denied?: boolean;
}

export interface CachedCallOptions<T> {
	/** 缓存键（含接口名与参数哈希，同参同键） */
	key: string;
	/** 缓存目录 */
	dir: string;
	/** 关掉缓存时直接透传（不读也不写） */
	enabled: boolean;
	/** 新鲜期（秒） */
	ttl: number;
	/** 过期后还能当兜底用多久（秒） */
	stale: number;
	/** 真正发请求 */
	load: () => Promise<FetchOutcome<T>>;
}

interface Entry {
	/** 写入时间（毫秒时间戳） */
	savedAt: number;
	value: unknown;
}

interface Cooldown {
	until: number;
	reason: string;
}

const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<FetchOutcome<unknown>>>();

const stats = { hit: 0, stale: 0, fetch: 0, denied: 0, skipped: 0 };

/** 缓存命中情况，dev 下打印一行用 */
export function wereadCacheStats() {
	return { ...stats };
}

/** 项目根目录，供调用方解析相对缓存目录 */
export function resolveCacheDir(dir?: string): string {
	if (!dir?.trim()) return DEFAULT_CACHE_DIR;
	return path.isAbsolute(dir) ? dir : path.join(PROJECT_ROOT, dir);
}

// ---------------------------------------------------------------------------
// 键 / 序列化
// ---------------------------------------------------------------------------

// 递归按 key 排序后序列化，保证同样的参数永远算出同样的哈希
function stableStringify(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value) ?? "null";
	}
	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(",")}]`;
	}
	const record = value as Record<string, unknown>;
	const body = Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
		.join(",");
	return `{${body}}`;
}

/**
 * 缓存键：接口名做可读前缀，参数 + 网关版本 + 账号指纹做哈希。
 * 年份 / 月份 / 书籍 ID 都在 payload 里，所以不同参数不会串味；
 * account 是 API Key 的哈希（不是 Key 本身），换了账号不会读到上一个账号的缓存。
 */
export function makeCacheKey(
	apiName: string,
	payload: Record<string, unknown>,
	version: string,
	account = "",
): string {
	const slug = apiName
		.replace(/^\/+/, "")
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/-+$/, "")
		.toLowerCase();
	const hash = crypto
		.createHash("sha256")
		.update(stableStringify({ apiName, payload, version, account }))
		.digest("hex")
		.slice(0, 16);
	return `${slug}-${hash}`;
}

// ---------------------------------------------------------------------------
// 磁盘读写
// ---------------------------------------------------------------------------

function entryPath(dir: string, key: string): string {
	return path.join(dir, `${key}.json`);
}

async function readEntry(dir: string, key: string): Promise<Entry | null> {
	try {
		const raw = await fs.readFile(entryPath(dir, key), "utf-8");
		const parsed = JSON.parse(raw) as Entry;
		if (typeof parsed?.savedAt !== "number") return null;
		return parsed;
	} catch {
		// 文件不存在 / 解析失败都当作没有缓存，不要影响构建
		return null;
	}
}

async function writeEntry(dir: string, key: string, value: unknown): Promise<void> {
	const file = entryPath(dir, key);
	try {
		await fs.mkdir(dir, { recursive: true });
		const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
		await fs.writeFile(
			tmp,
			JSON.stringify({ savedAt: Date.now(), value }),
			{ mode: 0o600 },
		);
		// rename 是原子操作：并发构建时要么是旧文件，要么是新文件，不会读到半个 JSON
		await fs.rename(tmp, file);
	} catch {
		// 写缓存失败（只读 FS、沙箱）不该让页面挂掉
	}
}

// ---------------------------------------------------------------------------
// 冷却窗口 / 强制刷新标记
// ---------------------------------------------------------------------------

async function readCooldown(dir: string): Promise<Cooldown | null> {
	try {
		const raw = await fs.readFile(path.join(dir, COOLDOWN_FILE), "utf-8");
		const parsed = JSON.parse(raw) as Cooldown;
		if (typeof parsed?.until !== "number") return null;
		return parsed.until > Date.now() ? parsed : null;
	} catch {
		return null;
	}
}

async function writeCooldown(dir: string, reason: string): Promise<void> {
	try {
		await fs.mkdir(dir, { recursive: true });
		const body: Cooldown = {
			until: Date.now() + DENIED_COOLDOWN * 1000,
			reason,
		};
		await fs.writeFile(
			path.join(dir, COOLDOWN_FILE),
			JSON.stringify(body),
			{ mode: 0o600 },
		);
	} catch {
		// 忽略
	}
}

/**
 * 消费「立刻更新」标记：`pnpm books:refresh` 只删得掉磁盘，
 * 删不掉正在跑的 dev server 内存里的那份，所以脚本会写一个 _refresh 标记，
 * 这里第一次读到就清空内存、忽略冷却，然后把标记删掉（只生效一次）。
 */
async function consumeRefreshMarker(dir: string): Promise<boolean> {
	const marker = path.join(dir, REFRESH_MARKER);
	try {
		await fs.access(marker);
	} catch {
		return false;
	}
	memory.clear();
	try {
		await fs.rm(marker, { force: true });
	} catch {
		// 删不掉也无所谓，下次再读到会重来一遍
	}
	return true;
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

/**
 * 带缓存的调用。返回 null 表示既没有新数据、也没有可用的旧数据。
 *
 * 顺序：内存 → 磁盘 → 冷却判断 → 合并并发 → 真请求 → 回写 / 兜底旧数据
 */
export async function cachedCall<T>(
	options: CachedCallOptions<T>,
): Promise<T | null> {
	const { key, dir, enabled, ttl, stale, load } = options;

	if (!enabled) {
		stats.fetch++;
		const outcome = await load();
		if (outcome.denied) stats.denied++;
		return outcome.value;
	}

	// `pnpm books:refresh` 写的标记：这一次调用丢掉内存缓存、跳过冷却
	const forced = await consumeRefreshMarker(dir);

	const remembered = forced ? undefined : memory.get(key);
	const entry = remembered ?? (forced ? null : await readEntry(dir, key));
	// 从磁盘读到的那份顺手放进内存，本次进程后续调用就不用再碰磁盘
	if (!remembered && entry) memory.set(key, entry);

	const age = entry ? (Date.now() - entry.savedAt) / 1000 : Number.POSITIVE_INFINITY;

	if (entry && age < ttl) {
		stats.hit++;
		return entry.value as T;
	}

	// 冷却期内一律不发请求：有旧数据就用旧数据，没有就降级
	if (!forced) {
		const cooldown = await readCooldown(dir);
		if (cooldown) {
			stats.skipped++;
			if (entry && age < stale) {
				stats.stale++;
				return entry.value as T;
			}
			return null;
		}
	}

	// 并发合并：同一次构建里两处要同一份数据时只发一个请求
	const running = inflight.get(key);
	if (running) return (await running).value as T | null;

	const task = (async (): Promise<FetchOutcome<unknown>> => {
		stats.fetch++;
		const outcome = await load();
		if (outcome.value !== null) {
			const saved: Entry = { savedAt: Date.now(), value: outcome.value };
			memory.set(key, saved);
			await writeEntry(dir, key, outcome.value);
			return outcome;
		}
		if (outcome.denied) {
			stats.denied++;
			await writeCooldown(dir, `${key} 被网关拒绝`);
		}
		return outcome;
	})();

	inflight.set(key, task);
	try {
		const outcome = (await task) as FetchOutcome<T>;
		if (outcome.value !== null) return outcome.value;
		// 抓取失败：过期但还在兜底窗口内的缓存继续用，页面不会空掉
		if (entry && age < stale) {
			stats.stale++;
			return entry.value as T;
		}
		return null;
	} finally {
		inflight.delete(key);
	}
}

/** 清空内存缓存（测试 / 手动刷新用） */
export function clearWereadMemoryCache(): void {
	memory.clear();
}

/**
 * 清磁盘缓存，`pnpm books:refresh` 用它（更新数据只走命令行，页面不提供按钮）。
 * 默认只清会变的部分（书架 / 统计 / 冷却），`all` 为 true 时连书籍详情一起清。
 * 清完会写 _refresh 标记，正在跑的进程下一次调用就会丢掉内存缓存、跳过冷却——
 * 因为 dev 下只读缓存（新鲜期视为无限），必须靠删文件 + 这个标记才能触发重抓。
 */
export async function clearWereadCache(
	options: { all?: boolean; dir?: string } = {},
): Promise<{ removed: number; kept: number }> {
	const dir = resolveCacheDir(options.dir);

	let entries: string[] = [];
	try {
		entries = await fs.readdir(dir);
	} catch {
		entries = [];
	}

	let removed = 0;
	let kept = 0;

	if (options.all) {
		await fs.rm(dir, { recursive: true, force: true });
		removed = entries.length;
	} else {
		for (const name of entries) {
			if (name === REFRESH_MARKER) continue;
			if (name === COOLDOWN_FILE || VOLATILE.test(name)) {
				await fs.rm(path.join(dir, name), { force: true });
				removed++;
			} else {
				kept++;
			}
		}
	}

	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(path.join(dir, REFRESH_MARKER), String(Date.now()), {
		mode: 0o600,
	});

	return { removed, kept };
}

// ---------------------------------------------------------------------------
// 命令行入口
// 直接用 node / tsx 跑本文件时才执行，被 import 时完全不触发。
//   pnpm books:refresh        只清会变的部分（书架 / 统计 / 冷却），保留书籍详情
//   pnpm books:refresh:all    整个 cache/weread 清空，连书籍详情一起重清
// dev 下缓存是只读的（新鲜期视为无限），所以更新数据只能靠这里：
// 删缓存 + 写 _refresh 标记 → 下次页面请求重抓一次，之后回到只读。
// ---------------------------------------------------------------------------

/** 本文件是否被当作脚本直接执行（而不是被 import） */
function isDirectRun(): boolean {
	// 非 Node 运行时（比如 SSR 边缘环境）没有 process，直接当作「不是脚本入口」
	if (typeof process === "undefined") return false;
	const entry = process.argv?.[1];
	if (!entry) return false;
	const normalize = (target: string) =>
		path.resolve(target).replace(/\\/g, "/").toLowerCase();
	return normalize(entry) === normalize(fileURLToPath(import.meta.url));
}

async function refreshCacheCli(): Promise<void> {
	const all = process.argv.includes("--all");
	const { removed, kept } = await clearWereadCache({ all });
	const where = path
		.relative(PROJECT_ROOT, DEFAULT_CACHE_DIR)
		.replace(/\\/g, "/");

	if (removed === 0 && kept === 0) {
		console.log(`[books-refresh] ${where} 还是空的，下次构建会全新拉取`);
	}
	console.log(
		`[books-refresh] 清除 ${removed} 个文件${all ? "（整目录）" : ""}${
			kept ? `，保留 ${kept} 个书籍详情缓存` : ""
		}`,
	);
	console.log(
		"[books-refresh] 正在跑的 dev server 下次刷新页面就会重抓一次（之后回到只读）；要发布就再跑一次 pnpm build",
	);
}

if (isDirectRun()) {
	// 不在模块顶层 await：这个文件也会被页面 import，保持同步模块更省事
	refreshCacheCli().catch((error) => {
		console.error("[books-refresh] 清理失败：", error);
		process.exitCode = 1;
	});
}
