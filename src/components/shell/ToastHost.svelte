<script lang="ts">
/**
 * 全局消息提示（MessagePop）
 *
 * 底部居中的浮层，最多同时 4 条，按先后顺序堆叠、自动消失。
 * 视觉沿用参考实现：左侧 4px 色条 + 浅色底 + 圆形 info 图标 + hover 放大。
 *
 * 用法：
 *   import { showMessage } from "@/utils/message-pop";
 *   showMessage("已复制链接", { type: "success" });
 *
 * 宿主由 MainGridLayout 以 client:idle 挂载一次，不要在页面里重复挂。
 */
import { onMount } from "svelte";
import { fade, fly } from "svelte/transition";
import {
	MESSAGE_POP_EVENT,
	markMessagePopReady,
	type MessageDetail,
	type MessageType,
} from "@/utils/message-pop";

/** 同时最多显示几条，超出先挤掉最早的 */
const MAX_ITEMS = 4;

// 每条消息的配色照参考实现原样搬过来：浅底 + 同色系 4px 左描边 + 悬停加深放大
const ITEM_CLASS: Record<MessageType, string> = {
	success:
		"bg-green-100 dark:bg-green-900 border-green-500 dark:border-green-700 text-green-900 dark:text-green-100 hover:bg-green-200 dark:hover:bg-green-800",
	info: "bg-blue-100 dark:bg-blue-900 border-blue-500 dark:border-blue-700 text-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-800",
	warning:
		"bg-yellow-100 dark:bg-yellow-900 border-yellow-500 dark:border-yellow-700 text-yellow-900 dark:text-yellow-100 hover:bg-yellow-200 dark:hover:bg-yellow-800",
	error:
		"bg-red-100 dark:bg-red-900 border-red-500 dark:border-red-700 text-red-900 dark:text-red-100 hover:bg-red-200 dark:hover:bg-red-800",
};

const ICON_CLASS: Record<MessageType, string> = {
	success: "text-green-600",
	info: "text-blue-600",
	warning: "text-yellow-600",
	error: "text-red-600",
};

// 尊重系统的「减少动态效果」：只保留淡入淡出，不做位移
// 注意：SSR 时不能直接读 window.matchMedia —— 服务端环境可能只有 window 的空壳，
// 所以先确认它是个函数，再取值
const reduceMotion =
	typeof window !== "undefined" &&
	typeof window.matchMedia === "function" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const enterTransition = reduceMotion
	? { duration: 0 }
	: { y: 12, duration: 220, easing: (t: number) => 1 - (1 - t) ** 3 };
const exitTransition = { duration: reduceMotion ? 0 : 150 };

interface Item extends MessageDetail {
	id: number;
}

let items = $state<Item[]>([]);
let seq = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function remove(id: number): void {
	const timer = timers.get(id);
	if (timer !== undefined) {
		clearTimeout(timer);
		timers.delete(id);
	}
	items = items.filter((item) => item.id !== id);
}

function push(detail: MessageDetail): void {
	const item: Item = { ...detail, id: seq++ };

	// 满员时先移除最早的一条，动画各自独立，不会一起跳
	while (items.length >= MAX_ITEMS) {
		remove(items[0].id);
	}

	items = [...items, item];

	// duration <= 0 视为常驻，方便调试时截图
	if (item.duration > 0) {
		timers.set(
			item.id,
			setTimeout(() => remove(item.id), item.duration),
		);
	}
}

onMount(() => {
	const onShow = (event: Event) => {
		const detail = (event as CustomEvent<MessageDetail>).detail;
		if (!detail?.text) return;
		push(detail);
	};

	window.addEventListener(MESSAGE_POP_EVENT, onShow);
	// 通知工具函数：宿主就绪，把挂载前排队的那几条补发出来
	markMessagePopReady();

	return () => {
		window.removeEventListener(MESSAGE_POP_EVENT, onShow);
		for (const timer of timers.values()) clearTimeout(timer);
		timers.clear();
	};
});
</script>

<div class="message-pop">
	{#each items as item (item.id)}
		<div
			class="message-pop-item flex items-center border-l-4 rounded-lg p-2 transition duration-300 ease-in-out transform hover:scale-105 {ITEM_CLASS[
				item.type
			]}"
			role="alert"
			in:fly={enterTransition}
			out:fade={exitTransition}
		>
			<svg
				stroke="currentColor"
				viewBox="0 0 24 24"
				fill="none"
				class="h-5 w-5 flex-shrink-0 mr-2 {ICON_CLASS[item.type]}"
				xmlns="http://www.w3.org/2000/svg"
				aria-hidden="true"
			>
				<path
					d="M13 16h-1v-4h1m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					stroke-width="2"
					stroke-linejoin="round"
					stroke-linecap="round"
				></path>
			</svg>
			<p class="text-xs font-semibold">{item.text}</p>
		</div>
	{/each}
</div>

<style>
	.message-pop {
		position: fixed;
		left: 50%;
		bottom: 1.25rem;
		z-index: 1100;
		display: flex;
		flex-direction: column;
		gap: 0.5rem; /* 对应参考实现的 space-y-2 */
		width: min(24rem, calc(100vw - 2rem));
		transform: translateX(-50%);
		/* 容器不拦点击，只有消息本体可交互（hover 放大） */
		pointer-events: none;
	}

	.message-pop-item {
		pointer-events: auto;
	}

	.message-pop-item p {
		/* 长文本（URL、报错信息）不撑破容器 */
		min-width: 0;
		overflow-wrap: anywhere;
	}

	@media (max-width: 480px) {
		.message-pop {
			bottom: 0.75rem;
			width: calc(100vw - 1.5rem);
		}
	}
</style>
