/**
 * 站点统计 / 文章阅读量的浏览器端客户端。
 *
 * 两个统计组件（SiteVisitCounter / PostViewCounter）共用它，避免各自复制
 * 一份「visitorId + 超时 + 错误处理」。
 *
 * 请求一律走 `@/utils/api-client`：超时、取消、重试、错误归一化、请求 id 收集都在那里，
 * 这一层只描述「统计」这个业务域的语义。以前这里自带一份 fetch，并且**给 GET 也设了
 * `Content-Type: application/json`** —— 那个头会把简单请求升级成需要预检的请求，
 * 每次读计数都多一个 OPTIONS 往返。统一层只在带 body 时才设它。
 *
 * 失败直接抛出 `ApiError`，由调用方决定是静默还是记日志 —— 展示层不该因为统计挂掉。
 */
import { siteStatsConfig } from "@/config/siteStatsConfig";
import { createApiClient } from "@/utils/api-client";
import { getVisitorId } from "@/utils/visitor-id";

export type SiteStats = {
	views: number;
	visitors: number;
};

export { getVisitorId };

export type PostViews = {
	slug: string;
	views: number;
};

/** 与评论、点赞共用同一套调用层；两个域各自持有实例，只是复用实现 */
const client = createApiClient({
	baseUrl: siteStatsConfig.apiBaseUrl,
	timeoutMs: siteStatsConfig.requestTimeoutMs,
});

/**
 * 上报一次站点访问，返回写入后的最新计数。
 *
 * 不带幂等键：这是「加一次」，重发就是多加一次。api-client 因此不会自动重试
 * 没有幂等键的 POST —— 这里要的正是这个行为。
 */
export function reportSiteVisit(): Promise<SiteStats> {
	return client.request<SiteStats>("/api/v1/count/site/visits", {
		method: "POST",
		body: { visitorId: getVisitorId() },
	});
}

/** 只读取站点计数，不上报 */
export function fetchSiteStats(signal?: AbortSignal): Promise<SiteStats> {
	return client.request<SiteStats>("/api/v1/count/site", { signal });
}

/** 上报一次文章浏览，返回该文的最新阅读量。同样是「加一次」，不重试。 */
export function reportPostView(slug: string): Promise<PostViews> {
	return client.request<PostViews>("/api/v1/count/posts/views", {
		method: "POST",
		body: { slug },
	});
}

/** 后端单次批量查询的上限（对应 count.MaxSlugsPerQuery），超出的部分分批问 */
const POST_VIEWS_BATCH_SIZE = 100;

/** 批量读取文章阅读量；未读过的文章返回 0，不会缺项 */
export async function fetchPostViews(
	slugs: string[],
	signal?: AbortSignal,
): Promise<PostViews[]> {
	const results: PostViews[] = [];
	for (let i = 0; i < slugs.length; i += POST_VIEWS_BATCH_SIZE) {
		const batch = slugs.slice(i, i + POST_VIEWS_BATCH_SIZE);
		const query = new URLSearchParams({ slugs: batch.join(",") });
		const body = await client.request<{ items?: PostViews[] }>(
			`/api/v1/count/posts?${query.toString()}`,
			{ signal },
		);
		results.push(...(body.items ?? []));
	}
	return results;
}
