import crypto from "node:crypto";
import type { WereadConfig } from "@/types/wereadConfig";
import {
	type FetchOutcome,
	cachedCall,
	makeCacheKey,
	resolveCacheDir,
} from "@/utils/weread-cache";

// ============================================================================
// 微信读书数据抓取（仅服务端使用）
// ----------------------------------------------------------------------------
// 走官方 Agent Gateway：
//   POST https://i.weread.qq.com/api/agent/gateway
//   Authorization: Bearer wrk-xxxxxxxx
// 业务参数与 api_name / skill_version 平铺在 body 顶层，不要包一层 params。
// 网关只允许 weread.qq.com 跨域，所以必须在构建（或 SSR）时抓取，
// 不能放到浏览器里请求。
// ============================================================================

const GATEWAY = "https://i.weread.qq.com/api/agent/gateway";

/** 没配 Key 只提醒一次，避免一次构建刷几十行日志 */
let warnedNoKey = false;

/** dev 下忽略 `WEREAD_CACHE=off` 时只提醒一次 */
let warnedDevCacheOff = false;

// 书籍的阅读状态，书架上只会出现这两种：
//   reading  在读 —— 还在书架上、没读完
//   read     读过 —— 已移出书架的历史书（当前只同步书架，暂不会出现）
//   finished 读完 —— finishReading === 1
export type WereadBookStatus = "reading" | "read" | "finished";

export interface WereadBook {
	// 书籍 ID
	id: string;
	// 书名
	title: string;
	// 作者
	author: string;
	// 封面地址
	cover: string;
	// 分类，如「男生小说-仙侠武侠」
	category: string;
	// 微信读书阅读页地址
	link: string;
	// 最近阅读时间（Unix 秒），0 表示从未打开
	lastReadAt: number;
	// 阅读状态：在读 / 读完
	status: WereadBookStatus;
	// 书籍简介（/book/info 的 intro），可能为空
	intro: string;
	// 全书字数：章节目录里各章 wordCount 之和，0 表示没取到
	wordCount: number;
	// 微信读书推荐值，0~1000（912 = 9.12 分），0 表示暂无评分
	rating: number;
	// 参与评分的人数，0 表示没取到
	ratingCount: number;
}

export interface WereadStats {
	// 本月
	monthReadTime: number; // 秒
	monthReadDays: number; // 天
	monthDailyAverage: number; // 秒，官方口径：本月总时长 / 本月已过天数
	monthNotes: number; // 条
	// 累计
	totalReadTime: number; // 秒
	totalReadDays: number; // 天
	totalReadCount: number; // 读过多少本
	totalFinished: number; // 读完多少本
	totalNotes: number; // 笔记条数
	// 偏好分类（本月阅读时长最高的）
	topCategory: string;
}

export interface WereadData {
	// 是否成功拿到书架
	ok: boolean;
	// 微信读书书架上的书，按最近阅读时间倒序
	books: WereadBook[];
	// 阅读统计，接口失败时为 null
	stats: WereadStats | null;
	// 阅读热力图数据，接口失败或关闭时 null
	calendar: WereadCalendar | null;
}

export interface WereadCalendar {
	// 有阅读记录的年份，倒序（最新在前）
	years: number[];
	// "YYYY-MM-DD" → 当天阅读秒数，只保留有记录的天
	days: Record<string, number>;
}

// 网关返回体里只关心这部分，其余字段忽略
interface ShelfResponse {
	books?: Array<{
		bookId?: string;
		title?: string;
		author?: string;
		cover?: string;
		category?: string;
		deepLink?: string;
		readerLink?: string;
		finishReading?: number;
		readUpdateTime?: number;
	}>;
}

interface ReadStatEntry {
	stat?: string;
	counts?: string;
}

interface ReadDataResponse {
	readTimes?: Record<string, number>;
	readDays?: number;
	dayAverageReadTime?: number;
	readStat?: ReadStatEntry[];
	totalReadTime?: number;
	preferCategory?: Array<{ categoryTitle?: string; readingTime?: number }>;
	errcode?: number;
	errmsg?: string;
}

// 书籍详情：简介与推荐值
interface BookInfoResponse {
	intro?: string;
	newRating?: number;
	newRatingCount?: number;
}

// 年度统计：dailyReadTimes 是「某天 00:00（北京时间）→ 当天阅读秒数」
interface AnnualResponse {
	dailyReadTimes?: Record<string, number>;
	readDays?: number;
	totalReadTime?: number;
	errcode?: number;
	errmsg?: string;
}

// 章节目录：没有「全书字数」字段，只能把每章的 wordCount 累加
interface ChapterInfoResponse {
	chapters?: Array<{ wordCount?: number }>;
}

// 解析接口错误
interface GatewayError {
	errcode?: number;
	errmsg?: string;
	upgrade_info?: unknown;
}

// 读取环境变量里的 Key。两个来源都要覆盖：
//   1) 系统 / 命令行 / 平台注入的环境变量（`WEREAD_API_KEY=xxx pnpm build`、setx、Vercel、CI）
//      —— 变量名没有 PUBLIC_ 前缀，Vite 不会把它塞进 import.meta.env，只有 process.env 读得到；
//   2) 项目根的 .env 文件（Astro 会合并进 import.meta.env，构建脚本用 tsx 跑时则不存在）。
function readEnvKey(): string {
	const fromProcess =
		typeof process === "undefined" ? undefined : process.env.WEREAD_API_KEY;
	if (fromProcess?.trim()) return fromProcess.trim();

	try {
		const env = import.meta.env as
			| Record<string, string | undefined>
			| undefined;
		return env?.WEREAD_API_KEY?.trim() ?? "";
	} catch {
		return "";
	}
}

/**
 * 是否跑在 `astro dev` 开发服务器里。
 * 构建时是 false；tsx 脚本（books:refresh 等）里 import.meta.env 不存在，也返回 false。
 */
function isDevServer(): boolean {
	try {
		const env = import.meta.env as { DEV?: boolean } | undefined;
		return Boolean(env?.DEV);
	} catch {
		return false;
	}
}

/**
 * 真正打网关：网络 / 超时 / errcode 一律返回 value: null，由调用方降级，
 * 保证图书页在 API 不可用时也能构建成功。
 * denied 用来标记「限流型」失败（429 / 403），交给缓存层触发冷却，别再硬试。
 */
async function requestGateway<T>(
	apiName: string,
	apiKey: string,
	config: WereadConfig,
	payload: Record<string, unknown>,
): Promise<FetchOutcome<T>> {
	const controller = new AbortController();
	const timer = setTimeout(
		() => controller.abort(),
		Math.max(1000, config.timeout ?? 8000),
	);

	try {
		const res = await fetch(GATEWAY, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				api_name: apiName,
				skill_version: config.skillVersion || "1.0.5",
				...payload,
			}),
			signal: controller.signal,
		});

		if (!res.ok) {
			console.warn(`[Weread] ${apiName}: HTTP ${res.status}`);
			return {
				value: null,
				denied: res.status === 429 || res.status === 403,
			};
		}

		const data = (await res.json()) as T & GatewayError;
		if (data.errcode) {
			console.warn(
				`[Weread] ${apiName}: errcode ${data.errcode} ${data.errmsg ?? ""}`,
			);
			return {
				value: null,
				denied: data.errcode === 429 || data.errcode === 403,
			};
		}
		if (data.upgrade_info) {
			console.warn(`[Weread] ${apiName}: 返回 upgrade_info，请升级 skill_version`);
		}
		return { value: data };
	} catch (error) {
		// 注意：这里只打接口名和错误本身，绝不打印 apiKey
		console.warn(`[Weread] ${apiName}: 请求失败`, error);
		return { value: null };
	} finally {
		clearTimeout(timer);
	}
}

/**
 * 各接口的缓存新鲜期（秒）。
 * 书架 / 统计一天内会变好几次，图书元数据（简介、字数、评分）几乎不变，可以放很久。
 */
const CACHE_TTL: Record<string, number> = {
	"/shelf/sync": 6 * 3600,
	"/book/info": 30 * 86400,
	"/book/chapterinfo": 30 * 86400,
};

function ttlSeconds(
	apiName: string,
	payload: Record<string, unknown>,
	config: WereadConfig,
): number {
	// 配置了统一 TTL（小时）就以配置为准，0 / 不填走内置分档
	const override = config.cacheTtl ?? 0;
	if (override > 0) return override * 3600;
	if (apiName === "/readdata/detail") {
		// 本月统计变化最快；累计 / 年度统计半天一次足够
		return payload.mode === "monthly" ? 2 * 3600 : 12 * 3600;
	}
	return CACHE_TTL[apiName] ?? 6 * 3600;
}

/**
 * 带缓存的网关调用。同一份数据在内存 / cache/weread/ 里命中就直接返回，
 * 不再打到微信读书；抓取失败时退回旧缓存，避免因为限流把页面搞空。
 */
async function callGateway<T>(
	apiName: string,
	config: WereadConfig,
	payload: Record<string, unknown> = {},
): Promise<T | null> {
	const apiKey = config.apiKey?.trim() || readEnvKey();
	if (!apiKey) {
		// 一次构建会调很多次，没配 Key 时只提醒一次就够
		if (!warnedNoKey) {
			warnedNoKey = true;
			console.warn(
				"[Weread] 未配置 API Key，图书页将降级为空书架（设置 WEREAD_API_KEY 环境变量，或直接填 wereadConfig.apiKey）",
			);
		}
		return null;
	}

	// astro dev 下只读缓存：平时会频繁刷新页面，缓存一过期就重新请求的话，
	// 一个下午就能把账号刷到限流。这里把新鲜期拉到无限——只要磁盘上存着一份就绝不请求。
	// 缓存缺失（首次运行，或刚跑过 books:refresh）时仍会抓一次，所以数据不会缺。
	// 要更新数据：pnpm books:refresh（或 books:refresh:all），别指望刷新页面。
	const devReadOnly = isDevServer();
	const wantsNoCache = process.env.WEREAD_CACHE === "off" || config.cache === false;
	if (devReadOnly && wantsNoCache && !warnedDevCacheOff) {
		warnedDevCacheOff = true;
		console.warn(
			"[Weread] dev 下强制只读缓存（忽略 WEREAD_CACHE=off / cache:false），避免刷新页面反复请求把账号刷到限流；要更新数据请跑 pnpm books:refresh",
		);
	}
	// 构建时的 WEREAD_CACHE=off 仍然有效，用来强制刷新一份全新的产物
	const cacheOff = wantsNoCache && !devReadOnly;

	return cachedCall<T>({
		key: makeCacheKey(
			apiName,
			payload,
			config.skillVersion || "1.0.5",
			// 只传 Key 的短哈希：换账号时自动换一套缓存，同时 Key 本身不进文件名
			crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 12),
		),
		dir: resolveCacheDir(config.cacheDir),
		// dev 下 cacheOff 恒为 false，所以这里一直是「读缓存」，缓存缺失时才抓
		enabled: !cacheOff,
		ttl: devReadOnly
			? Number.POSITIVE_INFINITY
			: ttlSeconds(apiName, payload, config),
		stale: Math.max(0, config.cacheStaleDays ?? 30) * 86400,
		load: () => requestGateway<T>(apiName, apiKey, config, payload),
	});
}

// 从 readStat 的「读过」「读完」「笔记」里取数字（形如 "13本" "49条"）
function pickStat(entries: ReadStatEntry[] | undefined, name: string): number {
	const hit = entries?.find((item) => item.stat === name);
	const value = Number.parseInt(hit?.counts ?? "", 10);
	return Number.isFinite(value) ? value : 0;
}

/**
 * 网关返回的字符串会被塞进 HTML / 属性，统一压掉控制字符并限长，
 * 免得异常数据把页面撑爆或者带出奇怪字符。
 */
function cleanText(value: unknown, max: number): string {
	if (typeof value !== "string") return "";
	const text = Array.from(value)
		.map((char) => {
			const code = char.codePointAt(0) ?? 0;
			// 控制字符、行分隔符一律换成空格，避免破坏排版
			const isBlank =
				code < 0x20 || code === 0x7f || code === 0x2028 || code === 0x2029;
			return isBlank ? " " : char;
		})
		.join("")
		.replace(/\s+/g, " ")
		.trim();
	return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** 只接受 https 绝对地址：挡住 javascript: / data: 这类伪协议进到 href / src */
function cleanUrl(value: unknown): string {
	if (typeof value !== "string" || !value) return "";
	try {
		const url = new URL(value);
		return url.protocol === "https:" ? url.toString() : "";
	} catch {
		return "";
	}
}

// 把书架原始条目整理成页面用的结构
function normalizeBooks(data: ShelfResponse | null): WereadBook[] {
	const books = data?.books ?? [];
	return books
		.filter((book) => book.title)
		.map((book) => ({
			id: cleanText(book.bookId, 32),
			title: cleanText(book.title, 120),
			author: cleanText(book.author, 80),
			cover: cleanUrl(book.cover),
			category: cleanText(book.category, 40),
			link:
				cleanUrl(book.deepLink) ||
				cleanUrl(book.readerLink) ||
				(book.bookId
					? `https://weread.qq.com/book-detail?type=1&v=${encodeURIComponent(cleanText(book.bookId, 32))}`
					: ""),
			lastReadAt: book.readUpdateTime ?? 0,
			// 书架上的书只有两种状态：读完 / 在读
			status: (book.finishReading === 1 ? "finished" : "reading") as WereadBookStatus,
			intro: "",
			wordCount: 0,
			rating: 0,
			ratingCount: 0,
		}))
		.sort((a, b) => b.lastReadAt - a.lastReadAt);
}

// 补详情时最多同时发几个请求，避免一次并行几十个把网关打挂
const META_CONCURRENCY = 4;

/**
 * 给每本书补上简介、字数、评分（详情弹窗用）。
 * 一次构建要发 books.length × 2 个请求，所以并发控制在 4，失败也不影响书架本身。
 */
async function attachBookMeta(
	config: WereadConfig,
	books: WereadBook[],
): Promise<void> {
	if (books.length === 0) return;

	let cursor = 0;
	const worker = async () => {
		while (cursor < books.length) {
			const book = books[cursor++];
			if (!book.id) continue;
			const [info, chapters] = await Promise.all([
				callGateway<BookInfoResponse>("/book/info", config, {
					bookId: book.id,
				}),
				callGateway<ChapterInfoResponse>("/book/chapterinfo", config, {
					bookId: book.id,
				}),
			]);

			book.intro = cleanText(info?.intro, 600);
			book.rating = info?.newRating ?? 0;
			book.ratingCount = info?.newRatingCount ?? 0;
			book.wordCount = (chapters?.chapters ?? []).reduce(
				(sum, chapter) => sum + (chapter.wordCount ?? 0),
				0,
			);
		}
	};

	await Promise.all(
		Array.from({ length: Math.min(META_CONCURRENCY, books.length) }, worker),
	);
}

// 微信读书按北京时间切天：把时间戳整体挪 8 小时再取 UTC 日期，就是当天的日期键
const CALENDAR_TZ = 8 * 3600;

function toDateKey(unixSeconds: number): string {
	return new Date((unixSeconds + CALENDAR_TZ) * 1000).toISOString().slice(0, 10);
}

/**
 * 阅读热力图数据：按年取 dailyReadTimes，合并成 "YYYY-MM-DD" → 秒数。
 * 年度接口用 baseTime 定位年份，边界几天会跨年，按年份前缀过滤掉。
 */
async function fetchCalendar(
	config: WereadConfig,
): Promise<WereadCalendar | null> {
	const span = Math.max(1, Math.min(10, config.heatmapYears ?? 3));
	const nowYear = Number(
		toDateKey(Math.floor(Date.now() / 1000)).slice(0, 4),
	);
	const years = Array.from({ length: span }, (_, i) => nowYear - i);

	const responses = await Promise.all(
		years.map((year) =>
			callGateway<AnnualResponse>("/readdata/detail", config, {
				mode: "annually",
				baseTime: Math.floor(Date.UTC(year, 0, 1) / 1000) + CALENDAR_TZ,
			}),
		),
	);

	const days: Record<string, number> = {};
	const filled: number[] = [];

	responses.forEach((res, index) => {
		const daily = res?.dailyReadTimes;
		if (!daily) return;
		const year = years[index];
		const prefix = String(year);
		let hasData = false;
		for (const [stamp, seconds] of Object.entries(daily)) {
			if (!seconds || seconds <= 0) continue;
			const key = toDateKey(Number(stamp));
			if (!key.startsWith(prefix)) continue;
			days[key] = seconds;
			hasData = true;
		}
		if (hasData) filled.push(year);
	});

	if (filled.length === 0) return null;
	return { years: filled, days };
}

/**
 * 拉取书架 + 阅读统计 + 热力图数据。请求并行，任一失败不影响其它部分。
 * 书架只同步微信读书书架上的书，不从阅读记录 / 笔记里反推。
 */
export async function fetchWereadData(
	config: WereadConfig,
): Promise<WereadData> {
	const [shelf, monthly, overall, calendar] = await Promise.all([
		callGateway<ShelfResponse>("/shelf/sync", config),
		callGateway<ReadDataResponse>("/readdata/detail", config, {
			mode: "monthly",
		}),
		callGateway<ReadDataResponse>("/readdata/detail", config, {
			mode: "overall",
		}),
		config.showHeatmap === false ? null : fetchCalendar(config),
	]);

	const books = normalizeBooks(shelf);

	// 详情弹窗要的简介 / 字数 / 评分：只补真正会展示的那几本
	if (config.showDetail !== false && books.length > 0) {
		const limit = Math.max(0, config.limit ?? 0);
		await attachBookMeta(config, limit > 0 ? books.slice(0, limit) : books);
	}

	let stats: WereadStats | null = null;
	if (monthly || overall) {
		const topCategory = (monthly?.preferCategory ?? [])
			.filter((item) => (item.readingTime ?? 0) > 0)
			.sort((a, b) => (b.readingTime ?? 0) - (a.readingTime ?? 0))[0]
			?.categoryTitle;

		stats = {
			monthReadTime: monthly?.totalReadTime ?? 0,
			monthReadDays: monthly?.readDays ?? 0,
			monthDailyAverage:
				monthly?.dayAverageReadTime ??
				(monthly?.readDays
					? Math.round((monthly.totalReadTime ?? 0) / monthly.readDays)
					: 0),
			monthNotes: pickStat(monthly?.readStat, "笔记"),
			totalReadTime: overall?.totalReadTime ?? 0,
			totalReadDays: overall?.readDays ?? 0,
			totalReadCount: pickStat(overall?.readStat, "读过"),
			totalFinished: pickStat(overall?.readStat, "读完"),
			totalNotes: pickStat(overall?.readStat, "笔记"),
			topCategory: topCategory ?? "",
		};
	}

	return { ok: shelf !== null, books, stats, calendar };
}

// 秒 → 小时（保留一位小数，超过 100 小时取整）
export function formatHours(seconds: number): string {
	const hours = seconds / 3600;
	if (!Number.isFinite(hours) || hours <= 0) return "0";
	return hours >= 100 ? Math.round(hours).toString() : hours.toFixed(1);
}

// 秒 → 分钟（取整）
export function formatMinutes(seconds: number): string {
	const minutes = seconds / 60;
	if (!Number.isFinite(minutes) || minutes <= 0) return "0";
	return Math.round(minutes).toString();
}
