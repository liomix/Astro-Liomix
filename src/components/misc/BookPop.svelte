<script lang="ts">
/**
 * 图书详情弹窗（3D 书架里点「已经滑出来的那本书」时弹出）
 * ----------------------------------------------------------------------------
 * 原生 <dialog>：封面 + 书名/作者 + 分类/最近阅读 + 去微信读书阅读。
 * 父组件只管把 `book` 置为要展示的书、置为 null 关闭；关闭动作走 `onClose`，
 * 这样 Esc、点遮罩、点关闭按钮三条路径都能同步回父组件的状态。
 */
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";

interface BookInfo {
	id: string;
	title: string;
	author: string;
	cover: string;
	category: string;
	link: string;
	finished: boolean;
	/** 预格式化的最近阅读时间，空串表示没有记录 */
	lastReadText: string;
}

interface Props {
	/** 要展示的书；null 表示关闭 */
	book: BookInfo | null;
	onClose: () => void;
}

let { book, onClose }: Props = $props();

const readingLabel = i18n(I18nKey.booksReading);
const finishedLabel = i18n(I18nKey.booksFinished);
const openLabel = i18n(I18nKey.booksOpen);
const closeLabel = i18n(I18nKey.announcementClose);
const categoryLabel = i18n(I18nKey.categories);
const lastReadLabel = i18n(I18nKey.booksLastRead);

let dialogEl = $state<HTMLDialogElement | null>(null);
/** 关闭动画期间还要继续显示上一次的书，所以单独留一份 */
let shown = $state<BookInfo | null>(null);

$effect(() => {
	if (!dialogEl) return;
	if (book) {
		shown = book;
		if (!dialogEl.open) dialogEl.showModal();
	} else if (dialogEl.open) {
		dialogEl.close();
	}
});

// 点遮罩关闭（点内容区时 target 是子元素，不会误触）
function handleClick(event: MouseEvent) {
	if (event.target === dialogEl) dialogEl?.close();
}
</script>

<dialog
	bind:this={dialogEl}
	class="book-pop"
	aria-labelledby="book-pop-title"
	onclick={handleClick}
	onclose={onClose}
>
	<button
		type="button"
		class="book-pop-close"
		onclick={() => dialogEl?.close()}
		aria-label={closeLabel}
	>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M6 6 L18 18 M18 6 L6 18" />
		</svg>
	</button>

	{#if shown}
		<div class="book-pop-body">
			<figure class="book-pop-cover">
				{#if shown.cover}
					<img
						src={shown.cover}
						alt={shown.title}
						loading="lazy"
						decoding="async"
						referrerpolicy="no-referrer"
					/>
				{:else}
					<span class="book-pop-cover-blank" aria-hidden="true">书</span>
				{/if}
			</figure>

			<div class="book-pop-info">
				<span class="book-pop-status" class:is-finished={shown.finished}>
					{shown.finished ? finishedLabel : readingLabel}
				</span>

				<h2 class="book-pop-title" id="book-pop-title">{shown.title}</h2>
				{#if shown.author}
					<p class="book-pop-author">{shown.author}</p>
				{/if}

				{#if shown.category || shown.lastReadText}
					<dl class="book-pop-meta">
						{#if shown.category}
							<div class="book-pop-meta-row">
								<dt>{categoryLabel}</dt>
								<dd>{shown.category}</dd>
							</div>
						{/if}
						{#if shown.lastReadText}
							<div class="book-pop-meta-row">
								<dt>{lastReadLabel}</dt>
								<dd>{shown.lastReadText}</dd>
							</div>
						{/if}
					</dl>
				{/if}

				{#if shown.link}
					<a
						class="book-pop-open"
						href={shown.link}
						target="_blank"
						rel="noopener noreferrer"
					>
						<span>{openLabel}</span>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M5 12h14M13 6l6 6-6 6" />
						</svg>
					</a>
				{/if}
			</div>
		</div>
	{/if}
</dialog>

<style>
	/* 弹窗打开时锁住页面滚动 */
	:global(body:has(.book-pop[open])) {
		overflow: hidden;
	}

	.book-pop {
		/* 不要覆盖 UA 的 position：模态 dialog 默认是 fixed，绝对定位的关闭按钮即以它为基准 */
		width: min(92vw, 30rem);
		max-width: min(92vw, 30rem);
		max-height: min(86vh, 34rem);
		/* Tailwind preflight 会重置 UA 的 margin:auto，这里显式补回以保持居中 */
		inset: 0;
		margin: auto;
		padding: 0;
		border: 1px solid var(--line-divider);
		border-radius: 1.25rem;
		background: var(--card-bg);
		box-shadow: 0 24px 60px -18px rgb(0 0 0 / 0.38);
		overflow: hidden;
	}

	.book-pop:not([open]) {
		display: none;
	}

	.book-pop::backdrop {
		background: rgb(15 23 42 / 0.34);
		backdrop-filter: blur(3px);
	}

	.book-pop[open] {
		animation: book-pop-in 0.24s cubic-bezier(0.22, 0.8, 0.3, 1) both;
	}

	@keyframes book-pop-in {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.book-pop-body {
		display: flex;
		gap: 1.15rem;
		max-height: inherit;
		padding: 1.35rem 1.35rem 1.4rem;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.book-pop-cover {
		flex: none;
		width: clamp(5.5rem, 30%, 7.6rem);
		margin: 0;
		overflow: hidden;
		border-radius: 0.6rem;
		aspect-ratio: 3 / 4;
		background: var(--btn-regular-bg);
		box-shadow:
			0 0 0 1px rgb(0 0 0 / 6%),
			0 16px 30px -18px rgb(0 0 0 / 55%);
	}

	.book-pop-cover img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.book-pop-cover-blank {
		display: grid;
		height: 100%;
		place-items: center;
		color: var(--content-meta);
		font-size: 1.5rem;
	}

	.book-pop-info {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
		padding-right: 1.5rem;
	}

	.book-pop-status {
		align-self: flex-start;
		padding: 0.1rem 0.45rem;
		border-radius: 9999px;
		background: var(--btn-regular-bg);
		color: var(--content-meta);
		font-size: 0.7rem;
		line-height: 1.5;
	}

	.book-pop-status.is-finished {
		background: color-mix(in srgb, var(--primary) 14%, transparent);
		color: var(--primary);
	}

	.book-pop-title {
		margin: 0.1rem 0 0;
		color: rgb(0 0 0 / 90%);
		font-size: 1.15rem;
		font-weight: 700;
		line-height: 1.35;
		text-wrap: pretty;
	}

	:global(:root.dark) .book-pop-title {
		color: rgb(255 255 255 / 92%);
	}

	.book-pop-author {
		margin: 0;
		overflow: hidden;
		color: var(--content-meta);
		font-size: 0.8rem;
		line-height: 1.5;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.book-pop-meta {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin: 0.55rem 0 0;
	}

	.book-pop-meta-row {
		display: flex;
		gap: 0.6rem;
		min-width: 0;
		font-size: 0.78rem;
		line-height: 1.5;
	}

	.book-pop-meta-row dt {
		flex: none;
		color: var(--content-meta);
	}

	.book-pop-meta-row dd {
		min-width: 0;
		margin: 0;
		overflow: hidden;
		color: var(--deep-text);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.book-pop-open {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		margin-top: auto;
		padding-top: 0.9rem;
		color: var(--primary);
		font-size: 0.82rem;
		font-weight: 600;
		text-decoration: none;
		transition: gap 0.2s ease;
	}

	.book-pop-open svg {
		width: 0.95rem;
		height: 0.95rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.book-pop-open:hover {
		gap: 0.6rem;
	}

	.book-pop-close {
		position: absolute;
		top: 0.7rem;
		right: 0.7rem;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.7rem;
		height: 1.7rem;
		border: 0;
		border-radius: 9999px;
		background: transparent;
		color: inherit;
		opacity: 0.55;
		cursor: pointer;
		transition:
			opacity 0.15s ease,
			background-color 0.15s ease;
	}

	.book-pop-close:hover {
		opacity: 1;
		background: var(--btn-plain-bg-hover);
	}

	.book-pop-close svg {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}

	.book-pop-open:focus-visible,
	.book-pop-close:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	@media (max-width: 480px) {
		.book-pop-body {
			gap: 0.9rem;
			padding: 1.15rem 1.1rem 1.2rem;
		}

		.book-pop-title {
			font-size: 1.05rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.book-pop[open] {
			animation: none;
		}

		.book-pop-open {
			transition: none;
		}
	}
</style>
