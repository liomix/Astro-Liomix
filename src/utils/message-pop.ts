/**
 * 全局消息提示（MessagePop）
 *
 * 宿主组件 `src/components/misc/MessagePop.svelte` 在 MainGridLayout 挂载一次，
 * 任意客户端脚本 import { showMessage } 即可发一条提示：
 *
 *   showMessage("已复制链接", { type: "success" });
 *   showMessage("网络异常，请稍后重试", { type: "error", duration: 5000 });
 *
 * 组件还没水合时（client:idle），消息先入队，挂载后按顺序补发，不会丢。
 */

export type MessageType = "success" | "info" | "warning" | "error";

export interface MessageOptions {
	/** 配色与图标：success / info / warning / error，默认 info */
	type?: MessageType;
	/** 自动消失时间（毫秒），默认 3200；传 0 或负数表示不自动消失 */
	duration?: number;
}

export interface MessageDetail {
	text: string;
	type: MessageType;
	duration: number;
}

/** 组件监听的事件名，需要手动派发时用这个常量 */
export const MESSAGE_POP_EVENT = "message-pop:show";

const DEFAULT_DURATION = 3200;
/** 组件未挂载时最多缓存这么多条，超出丢弃最早的 */
const MAX_PENDING = 8;

let ready = false;
const pending: MessageDetail[] = [];

function dispatch(detail: MessageDetail): void {
	window.dispatchEvent(
		new CustomEvent<MessageDetail>(MESSAGE_POP_EVENT, { detail }),
	);
}

/** 发一条消息提示；空文本会被忽略 */
export function showMessage(text: string, options: MessageOptions = {}): void {
	const content = text?.trim();
	if (!content) return;

	const detail: MessageDetail = {
		text: content,
		type: options.type ?? "info",
		duration: options.duration ?? DEFAULT_DURATION,
	};

	if (!ready) {
		pending.push(detail);
		if (pending.length > MAX_PENDING) pending.shift();
		return;
	}

	dispatch(detail);
}

/** 由 MessagePop 在挂载后调用：标记宿主就绪，并把排队中的消息补发出去 */
export function markMessagePopReady(): void {
	ready = true;
	for (const detail of pending.splice(0)) dispatch(detail);
}
