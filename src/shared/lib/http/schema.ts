/**
 * 构建期响应结构校验（规范 §4.4）。
 *
 * **只给构建期取数用**：导入方是 `features/<域>/client.ts`，而 client.ts 只被
 * `lib/load.ts` 在预渲染时调用。浏览器里的请求**不要**引这个文件——zod 会被打进首屏，
 * 运行期请在手写守卫里判形状（见 `features/dynamic/lib/memos-adapter.ts`）。
 *
 * 失败形态统一成 ApiError `kind: "schema"`：外部 API 改字段名时，构建会在这里停住，
 * 并打印「哪个字段、期望什么」——而不是渲染出一页空卡片。
 */

import type { ZodType } from "zod";
import { ApiError } from "./api-client";

/** 把 safeParse 的 issue 压成一行可读的定位信息，最多三条，避免刷屏 */
function describeIssues(
	issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): string {
	return issues
		.slice(0, 3)
		.map((issue) => {
			const path = issue.path.map(String).join(".") || "(root)";
			return `${path}: ${issue.message}`;
		})
		.join("; ");
}

/**
 * 校验并返回强类型结果。schema 不符时抛 ApiError，不返回半成品。
 *
 * @param label 出错时用来定位的端点名，例如 `bangumi.collections`
 */
export function parseResponse<T>(
	schema: ZodType<T>,
	data: unknown,
	label: string,
): T {
	const result = schema.safeParse(data);
	if (result.success) return result.data;

	const issues = describeIssues(result.error.issues);
	throw new ApiError({
		kind: "schema",
		code: "SCHEMA_MISMATCH",
		message: `[${label}] 响应结构不符合预期：${issues}`,
		detail: issues,
	});
}
