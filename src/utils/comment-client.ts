/**
 * 评论接口的浏览器端封装。
 *
 * 只做四件事：把页面路径换成后端认识的 slug、按游标拉一页、发一条、撤回自己那条；
 * 外加一件只读的「批量问评论数」，给动态卡片上的数字用。
 * 错误一律抛出 {@link ApiError}，由调用方决定显示什么 —— 这一层不做 UI 决策。
 *
 * 超时、重试、取消、错误归一化都不在这里，在 api-client；这一层只描述「评论」这个
 * 业务域的语义。分页用游标而不是页码：评论随时会有人发，页码一插就整体错位，
 * 而游标记的是「上一页最后一条」，插进来多少都不影响下一页从哪开始。
 *
 * `commentApiConfig.enable` 为 false 时整层退化成空实现：读接口返回空、写接口抛错。
 * 判断放在这里而不是各个调用方，是因为「开关关掉」和「请求失败」必须表现成两回事 ——
 * 少写一处判断，关掉开关的站点就会在抽屉里显示「评论加载失败」。
 */
import { commentApiConfig } from "@/config/commentApiConfig";
import { ApiError, createApiClient, newIdempotencyKey } from "@/utils/api-client";

/** 后端返回的单条评论（与 api/openapi.yaml 的 Comment 对应） */
export interface ApiComment {
	id: string;
	postSlug: string;
	/** 顶层评论是 null，不是「字段不存在」—— 回复树靠它判断根节点 */
	parentId: string | null;
	author: {
		name: string;
		/** 空串表示没留网址 */
		website: string;
		/**
		 * 站长本人的评论。后端按 SITE_OWNER_EMAILS 里的地址识别，用来显示标记，
		 * 不是权限 —— 老后端没有这个字段，所以按可选处理。
		 */
		isOwner?: boolean;
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

/** 一页评论。后端按时间倒序给，`nextCursor` 为空表示已经到底 */
export interface CommentPage {
	items: ApiComment[];
	/** 下一页的游标；null 表示没有更早的了 */
	nextCursor: string | null;
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

const ENABLED = commentApiConfig.enable;

/** 唯一的 HTTP 入口：这一层的所有请求都经过它 */
const client = createApiClient({
	baseUrl: commentApiConfig.apiBaseUrl,
	timeoutMs: commentApiConfig.requestTimeoutMs,
});

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

/**
 * 读取某个页面的一页已通过评论（后端默认只返回 approved）。
 *
 * `cursor` 为空是「最新一页」，往后翻就把它换成上一页返回的 `nextCursor`。
 * 调用方靠 `nextCursor === null` 判断到底了 —— 不要用「这一页不满」来猜：
 * 服务端在审核通过一条评论后会多出一条，猜测会立刻错位。
 */
export async function fetchComments(
	slug: string,
	cursor?: string | null,
	signal?: AbortSignal,
): Promise<CommentPage> {
	if (!ENABLED) return { items: [], nextCursor: null };

	const query = new URLSearchParams({ limit: String(commentApiConfig.pageSize) });
	if (cursor) query.set("cursor", cursor);

	const page = await client.request<{
		items?: ApiComment[];
		nextCursor?: string | null;
	}>(`/api/v1/posts/${encodeURIComponent(slug)}/comments?${query.toString()}`, {
		signal,
	});
	return { items: page.items ?? [], nextCursor: page.nextCursor ?? null };
}

/**
 * 发表一条评论，返回后端存下来的那条（可能仍是 pending，且带撤回凭据）。
 *
 * 带幂等键：网络在「后端已经写入」和「响应回到浏览器」之间断掉时，api-client 会
 * 用同一个键重发，后端认出是同一次提交并回放原响应，而不是多出一条评论。
 * 用户改内容再提交是新的一次，键由这里重新生成。
 */
export function postComment(
	slug: string,
	input: CreateCommentInput,
	signal?: AbortSignal,
): Promise<ApiComment> {
	if (!ENABLED) return Promise.reject(new CommentApiDisabledError());
	return client.request<ApiComment>(
		`/api/v1/posts/${encodeURIComponent(slug)}/comments`,
		{
			method: "POST",
			body: input,
			signal,
			// 每次提交一个新键；api-client 内部的重试会复用它
			idempotencyKey: newIdempotencyKey(),
		},
	);
}

/**
 * 撤回自己发的一条评论。
 *
 * 凭据是创建时后端给的那个 token —— 它不是管理员口令，只能删这一条。
 * 删除是级联的：这条下面的回复会一起消失，所以调用方应当在删之前让用户确认。
 *
 * 404 当作成功：DELETE 的目标状态是「这条不在了」，而重试一个已经成功的删除
 * 拿到的正是 404。把它当失败，用户会看到「删除失败」而消息其实已经没了。
 */
export async function deleteComment(
	id: string,
	deleteToken: string,
): Promise<void> {
	if (!ENABLED) throw new CommentApiDisabledError();
	try {
		await client.request<void>(`/api/v1/comments/${encodeURIComponent(id)}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${deleteToken}` },
			// 重试一次就该够：删除幂等，且再失败的话用户点一下比等更直观
			retries: 1,
		});
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) return;
		throw error;
	}
}

/**
 * 计数缓存的有效期。
 *
 * 卡片上的数字是装饰，30 秒内对同一个 slug 的重复提问直接复用上次的答案：
 * 动态页上卡片组件和侧栏组件会同时问同一批 slug，翻页回来也会再问一遍 ——
 * 没有这一层就是同一份数据发两次请求。
 */
const COUNT_TTL_MS = 30_000;

/** 缓存条数上限。一个会话翻过的动态会一直涨，必须有封顶 */
const COUNT_CACHE_MAX = 500;

const countCache = new Map<string, { count: number; at: number }>();

/** 同一批 slug 的并发请求只发一次；两个组件同时挂载时靠它合流 */
const countInflight = new Map<string, Promise<ApiCommentCount[]>>();

/**
 * 写入缓存。先删再插，让 Map 的插入顺序变成「最近被问到」的顺序，
 * 淘汰时从最久没被问到的开始 —— 不引第三方 LRU，够用。
 */
function rememberCount(slug: string, count: number): void {
	countCache.delete(slug);
	countCache.set(slug, { count, at: Date.now() });
	while (countCache.size > COUNT_CACHE_MAX) {
		const oldest = countCache.keys().next().value;
		if (oldest === undefined) break;
		countCache.delete(oldest);
	}
}

/**
 * 发一批计数请求，并按「排序后的 slug 列表」合流。
 *
 * 键排序而不是用原始顺序：两个调用方拼 slug 的顺序可能不同，但问的是同一件事。
 * 合流后只认第一个调用方的取消信号 —— 这一层不做引用计数，计数请求本身很短，
 * 为它维护一套信号合并不值得。
 */
function requestCounts(
	chunk: string[],
	signal?: AbortSignal,
): Promise<ApiCommentCount[]> {
	const key = [...chunk].sort().join(",");
	const running = countInflight.get(key);
	if (running) return running;

	const query = new URLSearchParams({ slugs: chunk.join(",") });
	const pending = client
		.request<{ items?: ApiCommentCount[] }>(
			`/api/v1/comments/counts?${query.toString()}`,
			{ signal },
		)
		.then((body) => body.items ?? [])
		.finally(() => {
			countInflight.delete(key);
		});
	countInflight.set(key, pending);
	return pending;
}

/**
 * 批量读取每篇的已审核评论数，结果按 slug 索引。
 *
 * 只包含「已知」的 slug：缓存里还新鲜的，加上这次真的问到答案的。后端没答的 slug
 * 不会出现在结果里 —— 调用方拿到的是「哪些数字可信」，而不是「其余都是 0」。
 * 把请求失败当成零，会让卡片上的数字凭空缩水，而这正是它要解决的问题。
 */
export async function fetchCommentCounts(
	slugs: string[],
	signal?: AbortSignal,
): Promise<Map<string, number>> {
	const counts = new Map<string, number>();
	if (!ENABLED) return counts;

	// 去重后按后端上限分批：一个页面里同一篇出现两次很常见（卡片 + 弹窗）
	const unique = Array.from(new Set(slugs.filter((slug) => slug !== "")));

	const now = Date.now();
	const missing: string[] = [];
	for (const slug of unique) {
		const hit = countCache.get(slug);
		if (hit && now - hit.at < COUNT_TTL_MS) {
			counts.set(slug, hit.count);
			continue;
		}
		missing.push(slug);
	}

	for (let i = 0; i < missing.length; i += COUNT_CHUNK_SIZE) {
		const chunk = missing.slice(i, i + COUNT_CHUNK_SIZE);
		for (const item of await requestCounts(chunk, signal)) {
			rememberCount(item.slug, item.count);
			counts.set(item.slug, item.count);
		}
	}
	return counts;
}
