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
	// 是否已读完
	finished: boolean;
	// 是否仍在书架里；false 表示已读完并被移出书架，由阅读记录补回来
	onShelf: boolean;
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
	// 按最近阅读时间倒序：在架书籍 + 已读完但移出书架的书
	books: WereadBook[];
	// 阅读统计，接口失败时为 null
	stats: WereadStats | null;
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

// 累计统计里按阅读时长排行的书籍（含已移出书架的书）
interface ReadLongestEntry {
	book?: {
		bookId?: string;
		title?: string;
		author?: string;
		cover?: string;
		deepLink?: string;
		readerLink?: string;
	};
	readTime?: number;
}

// 单本书的阅读进度：finishTime 有值才是「用户读完」，书自带的 finished 是「连载完结」
interface ProgressResponse {
	book?: {
		progress?: number;
		finishTime?: number;
		readingTime?: number;
		updateTime?: number;
	};
}

interface ReadDataResponse {
	readTimes?: Record<string, number>;
	readDays?: number;
	dayAverageReadTime?: number;
	readLongest?: ReadLongestEntry[];
	readStat?: ReadStatEntry[];
	totalReadTime?: number;
	preferCategory?: Array<{ categoryTitle?: string; readingTime?: number }>;
	errcode?: number;
	errmsg?: string;
}

// 解析接口错误
interface GatewayError {
	errcode?: number;
	errmsg?: string;
	upgrade_info?: unknown;
}

// 读取环境变量里的 Key（构建脚本用 tsx 直接跑时没有 import.meta.env，需兜底）
function readEnvKey(): string {
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
		console.warn(`[Weread] ${apiName}: 未配置 API Key，已跳过`);
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
			finished: book.finishReading === 1,
			onShelf: true,
		}))
		.sort((a, b) => b.lastReadAt - a.lastReadAt);
}

// 补查已读完书籍时最多问几本，避免构建期请求过多
const FINISHED_LOOKUP_LIMIT = 12;

/**
 * 已读完但被移出书架的书。
 * 书架接口只给「现在在架上的」，读完就移出书架的书会消失，
 * 所以在累计统计的 readLongest（按阅读时长排行的书）里找候选，
 * 再逐本查 /book/getprogress 用 finishTime 确认确实读完了。
 */
async function fetchFinishedBooks(
	config: WereadConfig,
	overall: ReadDataResponse | null,
	existing: WereadBook[],
): Promise<WereadBook[]> {
	const takenIds = new Set(existing.map((book) => book.id));
	const takenTitles = new Set(
		existing.map((book) => book.title.trim()).filter(Boolean),
	);

	const candidates: Array<NonNullable<ReadLongestEntry["book"]>> = [];
	for (const entry of overall?.readLongest ?? []) {
		const book = entry.book;
		if (!book?.bookId || !book.title) continue;
		const title = book.title.trim();
		// 同一本书可能既是书架条目又在排行里，或者出现不同 bookId 的同名版本
		if (takenIds.has(book.bookId) || takenTitles.has(title)) continue;
		takenIds.add(book.bookId);
		takenTitles.add(title);
		candidates.push(book);
		if (candidates.length >= FINISHED_LOOKUP_LIMIT) break;
	}

	const resolved = await Promise.all(
		candidates.map(async (book) => {
			const progress = await callGateway<ProgressResponse>(
				"/book/getprogress",
				config,
				{ bookId: book.bookId },
			);
			const info = progress?.book;
			// 没有 finishTime 说明只是读了一部分，留在「读过」里不进书架
			if (!info?.finishTime) return null;
			const finished: WereadBook = {
				id: book.bookId ?? "",
				title: book.title ?? "",
				author: book.author ?? "",
				cover: book.cover ?? "",
				category: "",
				link:
					book.deepLink ||
					book.readerLink ||
					`https://weread.qq.com/book-detail?type=1&v=${book.bookId}`,
				lastReadAt: info.updateTime ?? info.finishTime,
				finished: true,
				onShelf: false,
			};
			return finished;
		}),
	);

	return resolved.filter((book): book is WereadBook => book !== null);
}

/**
 * 拉取书架 + 阅读统计。三个请求并行，任一失败不影响其它部分。
 */
export async function fetchWereadData(
	config: WereadConfig,
): Promise<WereadData> {
	const [shelf, monthly, overall] = await Promise.all([
		callGateway<ShelfResponse>("/shelf/sync", config),
		callGateway<ReadDataResponse>("/readdata/detail", config, {
			mode: "monthly",
		}),
		callGateway<ReadDataResponse>("/readdata/detail", config, {
			mode: "overall",
		}),
	]);

	const books = normalizeBooks(shelf);

	// 读完但已移出书架的书也补进来，书架即「在架 + 读完」的全集
	if (config.includeFinished !== false) {
		const finishedBooks = await fetchFinishedBooks(config, overall, books);
		if (finishedBooks.length > 0) {
			books.push(...finishedBooks);
			books.sort((a, b) => b.lastReadAt - a.lastReadAt);
		}
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

	return { ok: shelf !== null, books, stats };
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
