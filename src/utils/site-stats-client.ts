/**
 * 站点统计 / 文章阅读量的浏览器端客户端。
 *
 * 两个统计组件（SiteVisitCounter / PostViewCounter）共用它，避免各自复制
 * 一份「visitorId + 超时 + 错误处理」。约定：
 *
 * - 所有请求都带超时，`credentials: "omit"`（统计端点无鉴权、不碰 Cookie）
 * - 失败直接抛出，由调用方决定是静默还是记日志——展示层不该因为统计挂掉
 */
import { siteStatsConfig } from "@/config/siteStatsConfig";

export type SiteStats = {
	views: number;
	visitors: number;
};

export type PostViews = {
	slug: string;
	views: number;
};

const VISITOR_ID_KEY = "firefly:visitor-id";
const API_BASE_URL = siteStatsConfig.apiBaseUrl.replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = siteStatsConfig.requestTimeoutMs;

/** localStorage 不可用时的会话内 visitorId */
let memoryVisitorId = "";

function mintVisitorId(): string {
	if (window.crypto?.randomUUID) return window.crypto.randomUUID();
	if (window.crypto?.getRandomValues) {
		const bytes = window.crypto.getRandomValues(new Uint8Array(16));
		return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
	}
	return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 稳定的浏览器标识，只用于让后端把同一个读者的多次访问去重成一位访客。
 * 访问量统计不依赖它，所以拿不到也能正常工作。
 */
export function getVisitorId(): string {
	try {
		const stored = window.localStorage.getItem(VISITOR_ID_KEY);
		if (stored) return stored;
		const minted = mintVisitorId();
		window.localStorage.setItem(VISITOR_ID_KEY, minted);
		return minted;
	} catch {
		// Safari 隐私模式等场景下 localStorage 会抛异常。退化为会话内固定 ID，
		// 至少同一次浏览不会把自己重复算成新访客。
		if (!memoryVisitorId) memoryVisitorId = mintVisitorId();
		return memoryVisitorId;
	}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const controller = new AbortController();
	const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetch(`${API_BASE_URL}${path}`, {
			...init,
			credentials: "omit",
			signal: controller.signal,
			headers: { "Content-Type": "application/json" },
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return (await response.json()) as T;
	} finally {
		window.clearTimeout(timer);
	}
}

/** 上报一次站点访问，返回写入后的最新计数 */
export function reportSiteVisit(): Promise<SiteStats> {
	return request<SiteStats>("/api/v1/count/site/visits", {
		method: "POST",
		body: JSON.stringify({ visitorId: getVisitorId() }),
	});
}

/** 只读取站点计数，不上报 */
export function fetchSiteStats(): Promise<SiteStats> {
	return request<SiteStats>("/api/v1/count/site");
}

/** 上报一次文章浏览，返回该文的最新阅读量 */
export function reportPostView(slug: string): Promise<PostViews> {
	return request<PostViews>("/api/v1/count/posts/views", {
		method: "POST",
		body: JSON.stringify({ slug }),
	});
}

/** 后端单次批量查询的上限（对应 count.MaxSlugsPerQuery），超出的部分分批问 */
const POST_VIEWS_BATCH_SIZE = 100;

/** 批量读取文章阅读量；未读过的文章返回 0，不会缺项 */
export async function fetchPostViews(slugs: string[]): Promise<PostViews[]> {
	const results: PostViews[] = [];
	for (let i = 0; i < slugs.length; i += POST_VIEWS_BATCH_SIZE) {
		const batch = slugs.slice(i, i + POST_VIEWS_BATCH_SIZE);
		const query = new URLSearchParams({ slugs: batch.join(",") });
		const body = await request<{ items: PostViews[] }>(
			`/api/v1/count/posts?${query.toString()}`,
		);
		results.push(...body.items);
	}
	return results;
}
