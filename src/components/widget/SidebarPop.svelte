<script lang="ts">
/**
 * 侧栏弹窗（通用外壳）
 * 原生 <dialog> + 标题栏（主题色竖条 / 计数 / 关闭）+ 可滚动内容区
 *
 * 两种用法：
 * 1. Svelte 内部使用：传 `children` 片段，用 `bind:open` 控制开关
 * 2. Astro 页面使用：传 `bodyText`，在任意触发元素上加 `data-sidebar-pop={id}`
 */
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { onMount, type Snippet } from "svelte";

interface Props {
	/** 触发元素上的 data-sidebar-pop 值，点击它即打开弹窗 */
	id?: string;
	title: string;
	/** 标题右侧的计数，省略则不显示 */
	count?: number;
	open?: boolean;
	size?: "md" | "lg";
	/** 纯文本内容（保留换行），与 children 二选一 */
	bodyText?: string;
	children?: Snippet;
}

let {
	id,
	title,
	count,
	open = $bindable(false),
	size = "md",
	bodyText,
	children,
}: Props = $props();

let dialogEl = $state<HTMLDialogElement | null>(null);

const closeLabel = i18n(I18nKey.announcementClose);

function openPop() {
	if (!dialogEl) return;
	if (!dialogEl.open) dialogEl.showModal();
	// 同一组件可能在桌面侧栏与移动端抽屉各渲染一份：
	// 隐藏的那份不会生成盒子，宽度为 0，直接关掉让可见的那份接手
	if (dialogEl.getBoundingClientRect().width === 0) {
		closePop();
		return;
	}
	open = true;
}

function closePop() {
	open = false;
	if (dialogEl?.open) dialogEl.close();
}

// 外部通过 bind:open 触发时同步到原生 dialog
$effect(() => {
	if (!dialogEl) return;
	if (open && !dialogEl.open) dialogEl.showModal();
	else if (!open && dialogEl.open) dialogEl.close();
});

// 点击遮罩（dialog 自身）关闭
function handleClick(event: MouseEvent) {
	if (event.target === dialogEl) closePop();
}

// 触发元素绑定（供 Astro 场景使用）；未水合时触发元素仍保留原生链接兜底
onMount(() => {
	if (!id) return;
	const selector = `[data-sidebar-pop="${id}"]`;
	const onClick = (event: MouseEvent) => {
		// 保留 Ctrl/⌘/Shift/中键点开新标签页等原生行为
		if (event.button !== 0) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return;
		const target = event.target as HTMLElement | null;
		if (!target?.closest(selector)) return;
		// 捕获阶段截住：Swup 等 SPA 路由的点击代理在冒泡阶段，
		// 不拦下来会先跳页，弹窗根本来不及出现
		event.preventDefault();
		event.stopPropagation();
		openPop();
	};
	document.addEventListener("click", onClick, true);
	return () => document.removeEventListener("click", onClick, true);
});
</script>

<dialog
	bind:this={dialogEl}
	class="sidebar-pop text-90"
	class:is-lg={size === "lg"}
	aria-label={title}
	onclick={handleClick}
	onclose={() => (open = false)}
>
	<header class="pop-head">
		<h2 class="pop-title">
			<span class="pop-title-bar" aria-hidden="true"></span>
			<span class="pop-title-text">{title}</span>
			{#if count !== undefined && count > 0}
				<span class="pop-count">{count}</span>
			{/if}
		</h2>
		<button type="button" class="pop-close" onclick={closePop} aria-label={closeLabel}>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M6 6 L18 18 M18 6 L6 18" />
			</svg>
		</button>
	</header>

	<div class="pop-body hide-scrollbar">
		{#if bodyText !== undefined}
			<p class="pop-text">{bodyText}</p>
		{:else}
			{@render children?.()}
		{/if}
	</div>
</dialog>

<style>
	/* 弹窗打开时锁住页面滚动 */
	:global(body:has(.sidebar-pop[open])) {
		overflow: hidden;
	}

	.sidebar-pop {
		width: min(92vw, 34rem);
		max-width: min(92vw, 34rem);
		max-height: min(82vh, 46rem);
		/* Tailwind preflight 会把 UA 的 margin:auto 重置掉，这里显式补回以保持居中 */
		inset: 0;
		margin: auto;
		padding: 0;
		border: 1px solid var(--line-divider);
		border-radius: 1rem;
		background: var(--card-bg);
		box-shadow: 0 24px 60px -16px rgb(0 0 0 / 0.35);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.sidebar-pop.is-lg {
		width: min(94vw, 44rem);
		max-width: min(94vw, 44rem);
	}

	.sidebar-pop:not([open]) {
		display: none;
	}

	.sidebar-pop::backdrop {
		background: rgb(15 23 42 / 0.34);
		backdrop-filter: blur(3px);
	}

	.sidebar-pop[open] {
		animation: pop-in 0.22s cubic-bezier(0.22, 0.8, 0.3, 1) both;
	}

	@keyframes pop-in {
		from {
			opacity: 0;
			transform: translateY(8px) scale(0.985);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.pop-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.875rem 1rem 0.75rem;
		border-bottom: 1px solid var(--line-divider);
	}

	.pop-title {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		line-height: 1.4;
	}

	.pop-title-bar {
		flex: none;
		width: 3px;
		height: 1.05em;
		border-radius: 9999px;
		background: var(--primary);
	}

	.pop-title-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pop-count {
		flex: none;
		font-size: 0.75rem;
		font-weight: 500;
		opacity: 0.55;
		font-variant-numeric: tabular-nums;
	}

	.pop-close {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border: 0;
		border-radius: 9999px;
		background: transparent;
		color: inherit;
		opacity: 0.6;
		cursor: pointer;
		transition: opacity 0.15s ease, background-color 0.15s ease;
	}

	.pop-close:hover {
		opacity: 1;
		background: var(--btn-plain-bg-hover);
	}

	.pop-close svg {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}

	.pop-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: 0.5rem;
		overscroll-behavior: contain;
	}

	.pop-text {
		margin: 0;
		padding: 0.375rem 0.5rem 0.5rem;
		font-size: 0.9375rem;
		line-height: 1.8;
		white-space: pre-line;
		word-break: break-word;
		text-wrap: pretty;
	}
</style>
