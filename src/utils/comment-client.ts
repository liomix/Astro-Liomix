/**
 * 评论接口的浏览器端封装。
 *
 * 只做四件事：把页面路径换成后端认识的 slug、按页拉列表、发一条、撤回自己那条；
 * 外加一件只读的「批量问评论数」，给动态卡片上的数字用。
 * 错误一律抛出，由调用方决定显示「加载失败」还是静默 —— 这一层不做 UI 决策。
 *
 * `commentApiConfig.enable` 为 false 时整层退化成空实现：读接口返回空、写接口抛错。
 * 判断放在这里而不是各个调用方，是因为「开关关掉」和「请求失败」必须表现成两回事 ——
 * 少写一处判断，关掉开关的站点就会在抽屉里显示「评论加载失败」。
 */
import { commentApiConfig } from "@/config/commentApiConfig";

/** 后端返回的单条评论（与 api/openapi.yaml 的 Comment 对应） */
export interface ApiComment {
	id: string;
	postSlug: string;
	parentId?: string;
	author: {
		name: string;
		website?: string;
	};
	body: string;
	status: string;
	createdAt: string;
	updatedAt: string;
	/**
	 * 撤回自己这条评论的凭据。
	 *
	 * 只有 POST 的响应里有 —— 后端只存它的摘要，读过一次就再也拿不到。
	 * 列表接口不会回传，所以刷新后靠本地存下的那份（见 comment-own.ts）。
	 */
	deleteToken?: string;
}

/** 提交一条评论所需的数据 */
export interface CreateCommentInput {
	author: {
		name: string;
		email: string;
	};
	body: string;
	/** 回复哪一条；为空则是新的顶层评论 */
	parentId?: string;
}

/** 一页评论。后端按时间倒序给，`hasMore` 表示还能不能往前翻 */
export interface CommentPage {
	items: ApiComment[];
	/** 这一页是不是被截断了（还有更早的） */
	hasMore: boolean;
	/** 这一页的起点，下一页从这里接着数 */
	offset: number;
}

/** 批量计数时后端返回的一项 */
interface ApiCommentCount {
	slug: string;
	count: number;
}

/**
 * 一次能问多少篇：与后端的 `MaxCountSlugs` 对齐。
 *
 * 超了后端直接 422，而不是「截断到一百」—— 静默少算一半比报错更难查。
 * 这里按批次切开，调用方永远不需要关心上限。
 */
const COUNT_CHUNK_SIZE = 100;

const API_BASE_URL = commentApiConfig.apiBaseUrl.replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = commentApiConfig.requestTimeoutMs;
const ENABLED = commentApiConfig.enable;

/** 评论接口是否启用；调用方据此决定要不要渲染评论入口 */
export function isCommentApiEnabled(): boolean {
	return ENABLED;
}

/** 开关关掉时写操作抛的错，调用方可以据此静默（而不是当成发送失败） */
export class CommentApiDisabledError extends Error {
	constructor() {
		super("comment api is disabled");
		this.name = "CommentApiDisabledError";
	}
}

/**
 * 把评论页的路径换成 slug。
 *
 * 后端把 slug 当成 URL 路径段，`/` 会把路由切成更多段，所以这里统一用 `-`
 * 连接：`/dynamic/2026-07-15-010756/` → `dynamic-2026-07-15-010756`。
 * 非法字符一并压成 `-`，既满足后端只收 `[A-Za-z0-9._-]` 的规则，
 * 又保证同一个页面永远算出同一个 slug（改个标点不会丢历史评论）。
 */
export function slugOfPath(path: string): string {
	const cleaned = path.trim().replace(/^\/+|\/+$/g, "");
	const slug = cleaned
		.replace(/[^A-Za-z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	// 没有任何可用字符时落到一个固定 slug：直接打开评论页也能评论，
	// 而不是因为「没有地址」把输入框锁死
	return slug || "dynamic";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const controller = new AbortController();
	const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		// 只有带 body 的请求才声称 JSON。GET 加上这个头会把一个简单请求升级成
		// 需要预检的请求，每读一次列表就多一个往返 —— 跨源部署下这个代价很实在。
		// 调用方显式给了头（比如 Authorization）就照用，不能因为没 body 丢掉。
		const headers = new Headers(init?.headers);
		if (init?.body && !headers.has("Content-Type")) {
			headers.set("Content-Type", "application/json");
		}
		const response = await fetch(`${API_BASE_URL}${path}`, {
			...init,
			credentials: "omit",
			signal: controller.signal,
			headers,
		});
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		// 204 没有 body：DELETE 成功就是这种，硬解 JSON 会抛在最后一步
		if (response.status === 204) return undefined as T;
		return (await response.json()) as T;
	} finally {
		window.clearTimeout(timer);
	}
}

/**
 * 读取某个页面的一页已通过评论（后端默认只返回 approved）。
 *
 * `offset` 是「跳过最新的多少条」：0 是最新一页，往后翻就是更早的消息。
 * 调用方靠 `hasMore` 判断还要不要显示「加载更早」。
 */
export async function fetchComments(
	slug: string,
	offset = 0,
): Promise<CommentPage> {
	if (!ENABLED) return { items: [], hasMore: false, offset };

	const limit = commentApiConfig.pageSize;
	const query = new URLSearchParams({
		limit: String(limit),
		offset: String(Math.max(0, offset)),
	});
	const body = await request<{ items?: ApiComment[] }>(
		`/api/v1/posts/${encodeURIComponent(slug)}/comments?${query.toString()}`,
	);
	const items = body.items ?? [];
	// 「这一页满了」就当还有：多问一页最坏拿到空数组，而少问一页会让用户
	// 永远看不到更早的评论。后端没有 total，这是唯一能做的判断
	return { items, hasMore: items.length >= limit, offset };
}

/** 发表一条评论，返回后端存下来的那条（可能仍是 pending，且带撤回凭据） */
export function postComment(
	slug: string,
	input: CreateCommentInput,
): Promise<ApiComment> {
	if (!ENABLED) return Promise.reject(new CommentApiDisabledError());
	return request<ApiComment>(
		`/api/v1/posts/${encodeURIComponent(slug)}/comments`,
		{
			method: "POST",
			body: JSON.stringify(input),
		},
	);
}

/**
 * 撤回自己发的一条评论。
 *
 * 凭据是创建时后端给的那个 token —— 它不是管理员口令，只能删这一条。
 * 删除是级联的：这条下面的回复会一起消失，所以调用方应当在删之前让用户确认。
 */
export function deleteComment(id: string, deleteToken: string): Promise<void> {
	if (!ENABLED) return Promise.reject(new CommentApiDisabledError());
	return request<void>(`/api/v1/comments/${encodeURIComponent(id)}`, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${deleteToken}` },
	});
}

/**
 * 批量读取每篇的已审核评论数，结果按 slug 索引。
 *
 * 只包含后端答过的 slug。调用方拿到的是「哪些数字可信」，而不是「其余都是 0」——
 * 把请求失败当成零，会让卡片上的数字凭空缩水，而这正是它要解决的问题。
 */
export async function fetchCommentCounts(
	slugs: string[],
): Promise<Map<string, number>> {
	const counts = new Map<string, number>();
	if (!ENABLED) return counts;

	// 去重后按后端上限分批：一个页面里同一篇出现两次很常见（卡片 + 弹窗）
	const unique = Array.from(new Set(slugs.filter((slug) => slug !== "")));

	for (let i = 0; i < unique.length; i += COUNT_CHUNK_SIZE) {
		const query = new URLSearchParams({
			slugs: unique.slice(i, i + COUNT_CHUNK_SIZE).join(","),
		});
		const body = await request<{ items: ApiCommentCount[] }>(
			`/api/v1/comments/counts?${query.toString()}`,
		);
		for (const item of body.items ?? []) {
			counts.set(item.slug, item.count);
		}
	}
	return counts;
}
