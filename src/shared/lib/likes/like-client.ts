/**
 * 点赞的浏览器端客户端
 * ---------------------------------------------------------------------------
 * 后端把「文章」和「动态」都当成一个 post slug：文章用自己的 slug，动态用
 * `dynamic-<id>`，所以这里一个函数同时服务两处，前端不需要区分类型。
 *
 * 接口（见后端 `internal/like`）：
 *   GET    /api/v1/posts/likes?slugs=a,b        读一批点赞数 + 我点过没有
 *   PUT    /api/v1/posts/{slug}/likes/{visitorId}   点赞（幂等：已赞返回 200）
 *   DELETE /api/v1/posts/{slug}/likes/{visitorId}   取消（幂等：没赞也返回 200）
 *
 * 读接口的访客身份放 `X-Visitor-Id` 头而不是 URL：URL 会进浏览器历史、Referer 和
 * 网关日志，这个标识虽然只是去重键，也不必到处留。
 *
 * 请求一律走 `@/utils/api-client`：超时、取消、重试、错误归一化都在那里。写操作
 * 是 PUT/DELETE（幂等），所以 api-client 允许它们自动重试 —— 重发一次不会多一条。
 */

import { createApiClient } from "@/shared/lib/http/api-client";
import { getVisitorId } from "@/shared/lib/visitor-id";
import { likeApiConfig } from "./config";

/** 一条 post 的点赞状态：总数 + 当前访客点过没有 */
export type LikeTally = {
	slug: string;
	count: number;
	liked: boolean;
};

type TalliesPayload = {
	items?: LikeTally[];
};

/** 后端一批最多接受的 slug 数（与 comment 的批量上限一致） */
export const MAX_TALLY_SLUGS = 100;

export function isLikeApiEnabled(): boolean {
	return likeApiConfig.enable;
}

const client = createApiClient({
	baseUrl: likeApiConfig.apiBaseUrl,
	timeoutMs: likeApiConfig.requestTimeoutMs,
});

/** 一篇文章或一条动态的路径段；slug 里的 `/` 必须转义，否则会变成两段 */
function likesPath(slug: string): string {
	return `/api/v1/posts/${encodeURIComponent(slug)}/likes/${encodeURIComponent(getVisitorId())}`;
}

/**
 * 批量读点赞数。结果里一定包含请求过的每个 slug（后端会补 0），
 * 顺序与请求一致，调用方可以直接按 id 建表。
 */
export async function fetchLikeTallies(
	slugs: string[],
	signal?: AbortSignal,
): Promise<LikeTally[]> {
	if (!likeApiConfig.enable || slugs.length === 0) return [];

	const unique = Array.from(new Set(slugs.filter(Boolean))).slice(
		0,
		MAX_TALLY_SLUGS,
	);
	const query = new URLSearchParams({ slugs: unique.join(",") });
	const body = await client.request<TalliesPayload>(
		`/api/v1/posts/likes?${query.toString()}`,
		{ headers: { "X-Visitor-Id": getVisitorId() }, signal },
	);
	return body.items ?? [];
}

/** 点赞。已经赞过时后端返回 200 和同样的数字，不会重复计数。 */
export function likePost(slug: string): Promise<LikeTally> {
	return client.request<LikeTally>(likesPath(slug), { method: "PUT" });
}

/** 取消点赞。没赞过时后端同样返回 200，数字就是当前（不含自己）的总数。 */
export function unlikePost(slug: string): Promise<LikeTally> {
	return client.request<LikeTally>(likesPath(slug), { method: "DELETE" });
}
