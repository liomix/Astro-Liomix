<script lang="ts">
/**
 * 打赏弹窗（文章页底部金币按钮的弹出层）
 * 原生 <dialog>：标题栏 + 收款码 + 用途说明 + 前往打赏页入口
 *
 * 用法：在触发元素上加 `data-sponsor-pop={id}`，本组件传同一个 `id`。
 * 触发元素本身保留 href 兜底（未水合、禁用 JS 时直接跳打赏页）。
 */
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { onMount } from "svelte";

interface Props {
	/** 触发元素上的 data-sponsor-pop 值 */
	id: string;
	/** 收款码图片（public 目录下的路径） */
	qrCode: string;
	/** 收款方式名，如「微信」，显示在二维码下方 */
	qrLabel?: string;
	title?: string;
	/** 打赏用途说明 */
	usage?: string;
}

let {
	id,
	qrCode,
	qrLabel = "",
	title = i18n(I18nKey.sponsorTitle),
	usage,
}: Props = $props();

let dialogEl = $state<HTMLDialogElement | null>(null);

const closeLabel = i18n(I18nKey.announcementClose);
const scanLabel = i18n(I18nKey.scanToSponsor);

function openPop() {
	if (!dialogEl || dialogEl.open) return;
	dialogEl.showModal();
}

function closePop() {
	if (dialogEl?.open) dialogEl.close();
}

// 点击遮罩（dialog 自身）关闭；点内容区时 target 是子元素，不会误触
function handleClick(event: MouseEvent) {
	if (event.target === dialogEl) closePop();
}

onMount(() => {
	const selector = `[data-sponsor-pop="${id}"]`;
	const onClick = (event: MouseEvent) => {
		// 保留 Ctrl/⌘/Shift/中键等原生打开新标签页的行为
		if (event.button !== 0) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const target = event.target as HTMLElement | null;
		if (!target?.closest(selector)) return;
		// 捕获阶段截住：Swup 的链接代理在冒泡阶段，不拦会先跳页
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
	class="sponsor-pop"
	aria-labelledby={`sponsor-pop-title-${id}`}
	onclick={handleClick}
>
	<header class="sponsor-pop-head">
		<h2 class="sponsor-pop-title" id={`sponsor-pop-title-${id}`}>
			<span class="sponsor-pop-title-bar" aria-hidden="true"></span>
			<span class="sponsor-pop-title-text">{title}</span>
		</h2>
		<button
			type="button"
			class="sponsor-pop-close"
			onclick={closePop}
			aria-label={closeLabel}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M6 6 L18 18 M18 6 L6 18" />
			</svg>
		</button>
	</header>

	<div class="sponsor-pop-body">
		{#if usage}
			<p class="sponsor-pop-usage">{usage}</p>
		{/if}

		<figure class="sponsor-pop-qr">
			<div class="sponsor-pop-qr-frame">
				<img
					src={qrCode}
					alt={`${qrLabel || title} ${scanLabel}`}
					width="600"
					height="600"
					decoding="async"
				/>
			</div>
			<figcaption class="sponsor-pop-qr-caption">
				{#if qrLabel}
					<span class="sponsor-pop-qr-label">{qrLabel}</span>
					<span class="sponsor-pop-qr-dot" aria-hidden="true">·</span>
				{/if}
				<span>{scanLabel}</span>
			</figcaption>
		</figure>
	</div>
</dialog>

<style>
	/* 弹窗打开时锁住页面滚动 */
	:global(body:has(.sponsor-pop[open])) {
		overflow: hidden;
	}

	.sponsor-pop {
		width: min(90vw, 21rem);
		max-width: min(90vw, 21rem);
		max-height: min(86vh, 40rem);
		/* Tailwind preflight 会重置 UA 的 margin:auto，这里显式补回以保持居中 */
		inset: 0;
		margin: auto;
		padding: 0;
		border: 1px solid var(--line-divider);
		border-radius: 1.25rem;
		background: var(--card-bg);
		box-shadow: 0 24px 60px -18px rgb(0 0 0 / 0.38);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.sponsor-pop:not([open]) {
		display: none;
	}

	.sponsor-pop::backdrop {
		background: rgb(15 23 42 / 0.34);
		backdrop-filter: blur(3px);
	}

	.sponsor-pop[open] {
		animation: sponsor-pop-in 0.24s cubic-bezier(0.22, 0.8, 0.3, 1) both;
	}

	@keyframes sponsor-pop-in {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.sponsor-pop-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.875rem 1rem 0.75rem;
		border-bottom: 1px solid var(--line-divider);
	}

	.sponsor-pop-title {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		line-height: 1.4;
	}

	.sponsor-pop-title-bar {
		flex: none;
		width: 3px;
		height: 1.05em;
		border-radius: 9999px;
		background: var(--primary);
	}

	.sponsor-pop-title-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sponsor-pop-close {
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
		transition:
			opacity 0.15s ease,
			background-color 0.15s ease;
	}

	.sponsor-pop-close:hover {
		opacity: 1;
		background: var(--btn-plain-bg-hover);
	}

	.sponsor-pop-close svg {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}

	.sponsor-pop-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: 1rem 1rem 1.25rem;
		overscroll-behavior: contain;
	}

	.sponsor-pop-usage {
		margin: 0 0 0.875rem;
		font-size: 0.8125rem;
		line-height: 1.7;
		color: var(--deep-text);
		opacity: 0.72;
		text-align: center;
		text-wrap: pretty;
	}

	.sponsor-pop-qr {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.625rem;
		margin: 0;
	}

	/* 二维码外框：白底承托，圆角 + 主题色微光，扫码时边界清晰 */
	.sponsor-pop-qr-frame {
		position: relative;
		width: min(62vw, 13.5rem);
		padding: 0.5rem;
		border-radius: 1rem;
		background: #fff;
		box-shadow:
			0 0 0 1px rgb(0 0 0 / 0.06),
			0 14px 30px -16px rgb(0 0 0 / 0.35);
	}

	.sponsor-pop-qr-frame img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.625rem;
	}

	.sponsor-pop-qr-caption {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.8125rem;
		color: var(--deep-text);
		opacity: 0.72;
	}

	.sponsor-pop-qr-label {
		font-weight: 600;
		color: var(--primary);
		opacity: 1;
	}

	.sponsor-pop-qr-dot {
		opacity: 0.5;
	}

	.sponsor-pop-close:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.sponsor-pop[open] {
			animation: none;
		}
	}
</style>
