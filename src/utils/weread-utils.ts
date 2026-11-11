import type { WereadConfig } from "@/types/wereadConfig";

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
 * 调用网关。失败（网络/超时/errcode）一律返回 null，由调用方降级，
 * 保证图书页在 API 不可用时也能构建成功。
 */
async function callGateway<T>(
	apiName: string,
	config: WereadConfig,
	payload: Record<string, unknown> = {},
): Promise<T | null> {
	const apiKey = config.apiKey?.trim() || readEnvKey();
	if (!apiKey) {
		console.warn(
			`[Weread] ${apiName}: 未配置 API Key，已跳过（设置 WEREAD_API_KEY 环境变量，或直接填 wereadConfig.apiKey）`,
		);
		return null;
	}

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
			return null;
		}

		const data = (await res.json()) as T & GatewayError;
		if (data.errcode) {
			console.warn(
				`[Weread] ${apiName}: errcode ${data.errcode} ${data.errmsg ?? ""}`,
			);
			return null;
		}
		if (data.upgrade_info) {
			console.warn(`[Weread] ${apiName}: 返回 upgrade_info，请升级 skill_version`);
		}
		return data;
	} catch (error) {
		console.warn(`[Weread] ${apiName}: 请求失败`, error);
		return null;
	} finally {
		clearTimeout(timer);
	}
}

// 从 readStat 的「读过」「读完」「笔记」里取数字（形如 "13本" "49条"）
function pickStat(entries: ReadStatEntry[] | undefined, name: string): number {
	const hit = entries?.find((item) => item.stat === name);
	const value = Number.parseInt(hit?.counts ?? "", 10);
	return Number.isFinite(value) ? value : 0;
}

// 把书架原始条目整理成页面用的结构
function normalizeBooks(data: ShelfResponse | null): WereadBook[] {
	const books = data?.books ?? [];
	return books
		.filter((book) => book.title)
		.map((book) => ({
			id: book.bookId ?? "",
			title: book.title ?? "",
			author: book.author ?? "",
			cover: book.cover ?? "",
			category: book.category ?? "",
			link:
				book.deepLink ||
				book.readerLink ||
				(book.bookId ? `https://weread.qq.com/book-detail?type=1&v=${book.bookId}` : ""),
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

			book.intro = info?.intro?.trim() ?? "";
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
