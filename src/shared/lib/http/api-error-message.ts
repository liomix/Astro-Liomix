/**
 * 把后端的错误码翻译成一句用户能看懂的话。
 *
 * 后端返回的 title/detail 是给开发者看的（"Request validation failed"），直接弹出来
 * 用户只会以为网站坏了。所以文案由前端按 `code` 决定，映射不到时再按错误大类兜底，
 * 最后无论如何都有一句话 —— 不能留空白，也不能把原始 title 露出去。
 */
import { ApiError } from "./api-client";

/** 四个兜底文案。具体页面可以覆盖，这里只负责「至少有一句话」 */
export interface ApiErrorLabels {
	/** 网络断了、超时 */
	network: string;
	/** 请求被拒绝（校验失败、找不到、没权限、冲突） */
	request: string;
	/** 服务端故障、限流 */
	server: string;
	/** 没登记的 code */
	unknown: string;
}

/**
 * code → 用哪一句。
 *
 * 新增错误码时在这里加一行就够；不加也会走大类兜底，不会变成空白。
 * 高频业务码（比如「这个昵称已经被占用」）应该在具体页面单独覆盖，
 * 这张表只负责不冷场。
 */
const CODE_LABELS: Record<string, keyof ApiErrorLabels> = {
	MALFORMED_REQUEST: "request",
	VALIDATION_FAILED: "request",
	PAYLOAD_TOO_LARGE: "request",
	UNSUPPORTED_MEDIA_TYPE: "request",
	UNAUTHENTICATED: "request",
	FORBIDDEN: "request",
	RESOURCE_NOT_FOUND: "request",
	RESOURCE_CONFLICT: "request",
	METHOD_NOT_ALLOWED: "request",
	RATE_LIMITED: "server",
	REQUEST_TIMEOUT: "server",
	DEPENDENCY_UNAVAILABLE: "server",
	INTERNAL_ERROR: "server",
};

/** 调用方主动取消：不是错误，不该提示用户 */
export function isAbortedRequest(error: unknown): boolean {
	return error instanceof ApiError && error.kind === "aborted";
}

/** 取一句能给用户看的话 */
export function apiErrorMessage(
	error: unknown,
	labels: ApiErrorLabels,
): string {
	if (!(error instanceof ApiError)) return labels.unknown;

	const mapped = CODE_LABELS[error.code];
	if (mapped) return labels[mapped];

	switch (error.kind) {
		case "network":
		case "timeout":
			return labels.network;
		case "client":
			return labels.request;
		case "server":
			return labels.server;
		default:
			return labels.unknown;
	}
}
