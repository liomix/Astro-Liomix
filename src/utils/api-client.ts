/**
 * 统一 HTTP 调用层。
 *
 * 页面和组件只调这一层，不直接 fetch：超时、取消、重试、错误归一化、请求 id 收集
 * 都收敛在这里，改一处就全站生效。业务域在上层再包一层薄的（见 comment-client）。
 *
 * 错误一律抛 {@link ApiError}，它把「网络断了」「超时了」「后端拒绝了」「后端崩了」
 * 分成四个 kind，页面只需要按 kind 和 code 分支，不解析文案。
 */

/** 失败的四大类，页面按它决定交互方式 */
export type ApiErrorKind =
	/** 断网、DNS 失败、连接被拒 —— 可以重试 */
	| "network"
	/** 超时或连接中途断开 —— 结果未知，不能直接说「失败了」 */
	| "timeout"
	/** 调用方主动取消（切页、换筛选）—— 不是错误，不要提示用户 */
	| "aborted"
	/** 4xx：请求本身有问题，重试只会重复失败 */
	| "client"
	/** 5xx：服务端故障，可重试但用户不必知道细节 */
	| "server";

/** problem+json 里的单字段错误 */
export interface ApiFieldError {
	/** 请求体里的路径，如 author.email；前端据此把错误标到输入框 */
	field: string;
	/** 机器可读的原因：REQUIRED / TOO_LONG / INVALID_FORMAT … */
	code: string;
	/** 给开发者看的说明，不是给终端用户的文案 */
	message: string;
}

/** 后端 RFC 9457 文档的形状，这里只声明用得到的字段 */
interface ProblemDocument {
	title?: string;
	status?: number;
	code?: string;
	detail?: string;
	instance?: string;
	traceId?: string;
	errors?: ApiFieldError[];
}

/**
 * 一次失败的全部信息。
 *
 * `requestId` 是排查的入口：把它贴给后端，对方能在日志里找到那一行。
 * 只有在后端通过 `Access-Control-Expose-Headers` 暴露了 `X-Request-Id` 时才读得到，
 * 否则是空串 —— 这时问题在 CORS 配置，不在埋点。
 */
export class ApiError extends Error {
	readonly kind: ApiErrorKind;
	/** HTTP 状态码；没有拿到响应时为 0 */
	readonly status: number;
	/** 稳定的错误码，分支只认它，不认 message */
	readonly code: string;
	readonly requestId: string;
	/** 面向开发者的补充说明，可能为空 */
	readonly detail: string;
	readonly fieldErrors: ApiFieldError[];
	/** 同一次请求重发一遍是否有意义 */
	readonly retryable: boolean;
	/** 服务端要求的等待秒数（429/503 会带 Retry-After），没有则为 0 */
	readonly retryAfterSeconds: number;

	constructor(init: {
		kind: ApiErrorKind;
		status?: number;
		code?: string;
		requestId?: string;
		detail?: string;
		fieldErrors?: ApiFieldError[];
		retryAfterSeconds?: number;
		message?: string;
	}) {
		super(init.message ?? init.code ?? init.kind);
		this.name = "ApiError";
		this.kind = init.kind;
		this.status = init.status ?? 0;
		this.code = init.code ?? "";
		this.requestId = init.requestId ?? "";
		this.detail = init.detail ?? "";
		this.fieldErrors = init.fieldErrors ?? [];
		this.retryAfterSeconds = init.retryAfterSeconds ?? 0;
		this.retryable =
			init.kind === "network" ||
			init.kind === "timeout" ||
			(init.kind === "server" && (init.status ?? 500) >= 500) ||
			init.status === 429;
	}
}

export interface ApiRequestOptions {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	/** 会被 JSON 序列化；不给则不带请求体 */
	body?: unknown;
	headers?: Record<string, string>;
	/** 外部取消信号：换页面、换筛选条件时传进来 */
	signal?: AbortSignal;
	/**
	 * 幂等键。写操作用它换取「重发不会产生第二条」的保证；
	 * 同一个业务操作的所有重试必须复用同一个键。
	 */
	idempotencyKey?: string;
	/** 覆盖默认超时 */
	timeoutMs?: number;
	/** 覆盖默认重试次数；写操作不带幂等键时强制为 0 */
	retries?: number;
}

export interface ApiClientOptions {
	/** 后端根地址，末尾斜杠会被去掉 */
	baseUrl: string;
	/** 单次尝试的超时，默认 8 秒 */
	timeoutMs?: number;
	/** 幂等请求的重试次数，默认 2 次（合计最多 3 次尝试） */
	retries?: number;
}

export interface ApiClient {
	request<T>(path: string, options?: ApiRequestOptions): Promise<T>;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 2;
/** 退避上限：再久用户已经在怀疑页面卡死了 */
const MAX_BACKOFF_MS = 8000;
const BASE_BACKOFF_MS = 200;

/** GET / HEAD / PUT / DELETE 天然幂等；POST 只有在带幂等键时才可以重发 */
function isIdempotent(method: string, options: ApiRequestOptions): boolean {
	switch (method) {
		case "GET":
		case "PUT":
		case "DELETE":
			return true;
		case "POST":
			return Boolean(options.idempotencyKey);
		default:
			return false;
	}
}

/**
 * 指数退避加抖动。
 *
 * 固定间隔会让所有客户端在同一毫秒重新涌上来，把一次抖动放大成雪崩；抖动是让它们
 * 错开，退避是让重试不要在原故障还没恢复时继续加压。
 */
function backoffDelay(attempt: number, retryAfterSeconds: number): number {
	if (retryAfterSeconds > 0) return retryAfterSeconds * 1000;
	const ceiling = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
	return ceiling * (0.5 + Math.random() * 0.5);
}

/** 可被取消的等待，取消时立刻抛 AbortError 而不是留着定时器 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		function onAbort() {
			clearTimeout(timer);
			reject(new DOMException("aborted", "AbortError"));
		}
		if (signal?.aborted) {
			onAbort();
			return;
		}
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

/** Retry-After 有两种写法：秒数或 HTTP 日期，两种都要认 */
function parseRetryAfter(header: string | null): number {
	if (!header) return 0;
	const seconds = Number(header);
	if (Number.isFinite(seconds) && seconds > 0) return seconds;
	const at = Date.parse(header);
	if (Number.isNaN(at)) return 0;
	return Math.max(0, (at - Date.now()) / 1000);
}

/**
 * 打一行能直接复制转发的诊断信息。
 *
 * 只打方法、路径、状态、错误码、请求 id：**不打请求体、不打 Authorization**。
 * 控制台会被共享屏幕、远程协助和报障截图带走，和日志一样是「会被人看到的地方」。
 */
function logFailure(method: string, url: string, error: ApiError): void {
	const line = `[api] ${method} ${url} → ${error.status || "-"} code=${
		error.code || "-"
	} requestId=${error.requestId || "-"}`;
	// 4xx 是用户输入问题，天天都会发生；用 debug 留在现场但不刷屏。
	// 5xx 和网络失败才是需要第一时间被看见的那一类。
	if (error.kind === "client") {
		console.debug(line);
	} else {
		console.error(line);
	}
}

/** 解析失败响应。不是 JSON 或解析不了时返回空对象，错误信息降级成状态码 */
async function readProblem(response: Response): Promise<ProblemDocument> {
	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("json")) return {};
	try {
		return (await response.json()) as ProblemDocument;
	} catch {
		return {};
	}
}

function toApiError(response: Response, problem: ProblemDocument): ApiError {
	const kind: ApiErrorKind = response.status >= 500 ? "server" : "client";
	return new ApiError({
		kind,
		status: response.status,
		code: problem.code ?? "",
		detail: problem.detail ?? "",
		// 响应头优先：CORS 没暴露时它是 null，退回 body 里的 traceId
		requestId: response.headers.get("X-Request-Id") ?? problem.traceId ?? "",
		fieldErrors: problem.errors ?? [],
		// Retry-After 有两种格式：秒数或 HTTP 日期，两种都认
		retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After")),
		message: problem.title ?? `HTTP ${response.status}`,
	});
}

/**
 * 构造一个客户端。每次尝试都重新计时并挂上取消信号，所以「超时」和「调用方取消」
 * 必须是两种错误 —— 前者要提示用户，后者连提示都不该有。
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
	const baseUrl = options.baseUrl.replace(/\/+$/, "");
	const defaultTimeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const defaultRetries = options.retries ?? DEFAULT_RETRIES;

	// url is absolute: request() is the only place that joins the base URL with
	// the path, so a caller cannot end up with "http://hosthttp://host/...".
	async function attempt<T>(
		url: string,
		method: string,
		opts: ApiRequestOptions,
	): Promise<T> {
		const controller = new AbortController();
		let timedOut = false;
		const timeoutMs = opts.timeoutMs ?? defaultTimeout;
		const timer = setTimeout(() => {
			timedOut = true;
			controller.abort();
		}, timeoutMs);

		// 外部取消和超时共用一个 controller：任一先到都会中止这次请求
		const external = opts.signal;
		const onExternalAbort = () => controller.abort();
		if (external) {
			if (external.aborted) controller.abort();
			else external.addEventListener("abort", onExternalAbort, { once: true });
		}

		const headers = new Headers();
		// 只有带 body 的请求才声称 JSON：GET 加上这个头会把简单请求升级成预检，
		// 每读一次列表就多一个往返。
		if (opts.body !== undefined) headers.set("Content-Type", "application/json");
		if (opts.idempotencyKey) headers.set("Idempotency-Key", opts.idempotencyKey);
		for (const [name, value] of Object.entries(opts.headers ?? {})) {
			headers.set(name, value);
		}

		try {
			const response = await fetch(url, {
				method,
				headers,
				body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
				credentials: "omit",
				signal: controller.signal,
			});

			if (!response.ok) {
				throw toApiError(response, await readProblem(response));
			}
			// 204 没有响应体：删除成功就是这种，硬解 JSON 会抛在最后一步
			if (response.status === 204) return undefined as T;
			return (await response.json()) as T;
		} catch (error) {
			if (error instanceof ApiError) throw error;
			if (external?.aborted && !timedOut) {
				throw new ApiError({ kind: "aborted", message: "request aborted by caller" });
			}
			if (timedOut) {
				throw new ApiError({ kind: "timeout", message: `request timed out after ${timeoutMs}ms` });
			}
			// fetch 在网络层失败时只给一个笼统的 TypeError，状态码都拿不到
			throw new ApiError({
				kind: "network",
				message: error instanceof Error ? error.message : "network request failed",
			});
		} finally {
			clearTimeout(timer);
			external?.removeEventListener("abort", onExternalAbort);
		}
	}

	return {
		async request<T>(path: string, opts: ApiRequestOptions = {}): Promise<T> {
			const method = opts.method ?? "GET";
			const url = `${baseUrl}${path}`;
			// 拼坏的地址会被 fetch 抛成 TypeError，落到 catch 里就变成「网络异常」，
			// 并且因为 network 可重试还会白白重发三次。这里先自己判一次，
			// 变成一句能看懂的配置错误，且不重试。
			try {
				new URL(url);
			} catch {
				throw new ApiError({
					kind: "client",
					message: `api base URL is not a valid URL: ${baseUrl}`,
				});
			}
			const allowed = isIdempotent(method, opts);
			// 没有幂等键的 POST 重发一次就可能多一条评论，所以这里一刀切禁止
			const retries = allowed ? (opts.retries ?? defaultRetries) : 0;

			let lastError: ApiError | undefined;
			for (let index = 0; index <= retries; index += 1) {
				try {
					return await attempt<T>(url, method, opts);
				} catch (error) {
					lastError = error as ApiError;
					// 调用方取消不是失败，直接冒泡，不重试、不打日志、不提示
					if (lastError.kind === "aborted") throw lastError;
					logFailure(method, url, lastError);
					if (!lastError.retryable || index === retries) throw lastError;
					await sleep(backoffDelay(index, lastError.retryAfterSeconds), opts.signal);
				}
			}
			// 循环至少跑过一次，走到这里说明最后一次尝试抛了错
			throw lastError ?? new ApiError({ kind: "network", message: "request failed" });
		},
	};
}

/**
 * 一次写操作的重试凭据。
 *
 * 同一次提交（哪怕因为超时被重发）必须复用同一个键，后端才能认出「这是同一次」；
 * 用户改了内容再提交是新的一次，要换新键。浏览器不支持 randomUUID 时退回
 * getRandomValues 拼一个，格式不重要，唯一就够了。
 */
export function newIdempotencyKey(): string {
	if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
