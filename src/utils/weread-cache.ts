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
// 冷却窗口
// ---------------------------------------------------------------------------

async function readCooldown(dir: string): Promise<Cooldown | null> {
	try {
		const raw = await fs.readFile(path.join(dir, "_cooldown.json"), "utf-8");
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
			path.join(dir, "_cooldown.json"),
			JSON.stringify(body),
			{ mode: 0o600 },
		);
	} catch {
		// 忽略
	}
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

	const remembered = memory.get(key);
	const entry = remembered ?? (await readEntry(dir, key));
	// 从磁盘读到的那份顺手放进内存，本次进程后续调用就不用再碰磁盘
	if (!remembered && entry) memory.set(key, entry);

	const age = entry ? (Date.now() - entry.savedAt) / 1000 : Number.POSITIVE_INFINITY;

	if (entry && age < ttl) {
		stats.hit++;
		return entry.value as T;
	}

	// 冷却期内一律不发请求：有旧数据就用旧数据，没有就降级
	const cooldown = await readCooldown(dir);
	if (cooldown) {
		stats.skipped++;
		if (entry && age < stale) {
			stats.stale++;
			return entry.value as T;
		}
		return null;
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
