<script lang="ts">
	/**
	 * 一张便签（GuestTag）。
	 *
	 * 只负责「把一条 GuestTagItem 画成纸片」，取数、点赞请求、删除请求都在
	 * GuestbookWall 里 —— 这里收到的 onReply / onRemove 是回调，点击后由墙去改数据。
	 *
	 * 底部两个按钮直接用全站原子组件那一套（atom-action 结构 + dynamic-lottie-icon）：
	 *   - 点赞：data-like 由 utils/likes.ts 的事件委托接管，不在这里写第二份逻辑；
	 *   - 评论：只提供 data-comment-base / data-comment-count 契约，点击回调交给墙 ——
	 *     留言评论后端还没单独成模块，先不接动态页的评论抽屉。
	 */
	import I18nKey from "@/i18n/i18nKey";
	import { i18n } from "@/i18n/translation";
	import { emojiTokensToHtml } from "@/utils/emoji-shortcode";
	import { formatCompactNumber } from "@/utils/number-utils";
	import "@/styles/components/atom-action.css";
	import {
		type GuestTagItem,
		likeSlugOfGuestTag,
		toneOfGuestTag,
	} from "./guest-tag";

	interface Props {
		note: GuestTagItem;
		/** 点赞接口关闭时按钮置灰，但仍然显示数字 */
		likeEnabled?: boolean;
		/** 评论按钮：交给墙去打开这条留言的评论抽屉（需要触发按钮本身做锚点） */
		onReply?: (note: GuestTagItem, trigger: HTMLElement) => void;
		onRemove?: (note: GuestTagItem) => void;
	}

	let { note, likeEnabled = true, onReply, onRemove }: Props = $props();

	/**
	 * 评论按钮的 DOM 引用。
	 * 不用 event.currentTarget：Svelte 5 的 onclick 是委托到根节点的，
	 * 回调里 currentTarget 可能不是按钮本身，而抽屉要用它做定位锚点和焦点归位。
	 */
	let commentButton = $state<HTMLButtonElement | null>(null);

	/** 正文按纯文本 + 表情短码渲染：转义在 emojiTokensToHtml 里做，换行补成 <br> */
	function bodyHtml(body: string): string {
		return emojiTokensToHtml(body, "guest-tag__emoji").replace(/\n/g, "<br />");
	}
</script>

<article
	class="guest-tag"
	class:guest-tag--pending={note.pending}
	data-tone={toneOfGuestTag(note.id)}
>
	<header class="guest-tag__head">
		<time class="guest-tag__date" datetime={note.createdAt}>
			{note.dateLabel}
		</time>
		<span class="guest-tag__side">
			{#if note.pending}
				<span class="guest-tag__pending">
					{i18n(I18nKey.commentChatPending)}
				</span>
			{/if}
			{#if note.mine && onRemove}
				<button
					type="button"
					class="guest-tag__del"
					aria-label={i18n(I18nKey.guestbookDelete)}
					title={i18n(I18nKey.guestbookDelete)}
					onclick={() => onRemove?.(note)}
				>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path
							d="M6 6l12 12M18 6L6 18"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
						/>
					</svg>
				</button>
			{/if}
		</span>
	</header>

	<p class="guest-tag__body">{@html bodyHtml(note.body)}</p>

	<footer class="guest-tag__foot">
		<div class="atom-actions guest-tag__actions">
			<button
				type="button"
				class="atom-action"
				data-like
				data-like-id={likeSlugOfGuestTag(note.id)}
				data-like-base={note.likes}
				aria-pressed={note.liked}
				aria-label={i18n(I18nKey.dynamicLike)}
				title={i18n(I18nKey.dynamicLike)}
				disabled={!likeEnabled}
			>
				<dynamic-lottie-icon data-animation="like-heart"></dynamic-lottie-icon>
				<span class="atom-action__count" data-like-count>
					{formatCompactNumber(note.likes)}
				</span>
			</button>

			<button
				type="button"
				class="atom-action"
				data-comment-base={note.replies}
				aria-label={i18n(I18nKey.dynamicComment)}
				title={i18n(I18nKey.dynamicComment)}
				bind:this={commentButton}
				onclick={() => {
					if (commentButton) onReply?.(note, commentButton);
				}}
			>
				<dynamic-lottie-icon data-animation="comment-chats"></dynamic-lottie-icon>
				<span class="atom-action__count" data-comment-count>
					{formatCompactNumber(note.replies)}
				</span>
			</button>
		</div>

		<span class="guest-tag__author" class:is-owner={note.isOwner}>
			{note.author}
		</span>
	</footer>
</article>

<style>
	/* 扁平的彩色纸片：小圆角、几乎无阴影，别做成带立体感的卡片 */
	.guest-tag {
		display: flex;
		flex-direction: column;
		min-width: 0;
		break-inside: avoid;
		margin-bottom: 0.75rem;
		padding: 0.9rem 1rem 0.7rem;
		border-radius: 0.25rem;
		background: var(--tag-bg, oklch(0.94 0.02 80));
		color: var(--tag-text, oklch(0.35 0.02 260));
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
	}

	/* 七种便签底色：都很浅、饱和度低，是便利贴不是色卡 */
	.guest-tag[data-tone="0"] {
		--tag-bg: oklch(0.925 0.045 20);
	}
	.guest-tag[data-tone="1"] {
		--tag-bg: oklch(0.965 0.06 95);
	}
	.guest-tag[data-tone="2"] {
		--tag-bg: oklch(0.93 0.04 245);
	}
	.guest-tag[data-tone="3"] {
		--tag-bg: oklch(0.95 0.05 185);
	}
	.guest-tag[data-tone="4"] {
		--tag-bg: oklch(0.935 0.045 320);
	}
	.guest-tag[data-tone="5"] {
		--tag-bg: oklch(0.95 0.055 140);
	}
	.guest-tag[data-tone="6"] {
		--tag-bg: oklch(0.94 0.035 230);
	}

	/* 深色主题：同色相压到能读白字的亮度，不是把浅色直接反色 */
	:global(.dark) .guest-tag {
		--tag-text: oklch(0.93 0.01 250);
	}
	:global(.dark) .guest-tag[data-tone="0"] {
		--tag-bg: oklch(0.36 0.06 20);
	}
	:global(.dark) .guest-tag[data-tone="1"] {
		--tag-bg: oklch(0.37 0.055 95);
	}
	:global(.dark) .guest-tag[data-tone="2"] {
		--tag-bg: oklch(0.36 0.05 245);
	}
	:global(.dark) .guest-tag[data-tone="3"] {
		--tag-bg: oklch(0.37 0.05 185);
	}
	:global(.dark) .guest-tag[data-tone="4"] {
		--tag-bg: oklch(0.36 0.05 320);
	}
	:global(.dark) .guest-tag[data-tone="5"] {
		--tag-bg: oklch(0.36 0.05 140);
	}
	:global(.dark) .guest-tag[data-tone="6"] {
		--tag-bg: oklch(0.36 0.05 230);
	}

	/* 待审核：虚线框，一眼看出「还没正式贴上去」 */
	.guest-tag--pending {
		outline: 1px dashed rgb(0 0 0 / 0.22);
		outline-offset: -1px;
	}

	:global(.dark) .guest-tag--pending {
		outline-color: rgb(255 255 255 / 0.22);
	}

	.guest-tag__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding-bottom: 0.3rem;
		margin-bottom: 0.5rem;
		border-bottom: 1px solid rgb(0 0 0 / 0.06);
	}

	:global(.dark) .guest-tag__head {
		border-bottom-color: rgb(255 255 255 / 0.1);
	}

	.guest-tag__date {
		font-size: 0.9rem;
		letter-spacing: 0.01em;
		opacity: 0.62;
	}

	.guest-tag__side {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	/* 「待审核」徽章：只在提交后本机可见，刷新会随列表一起消失 */
	.guest-tag__pending {
		padding: 0.06rem 0.4rem;
		border-radius: 0.2rem;
		background: rgb(0 0 0 / 0.08);
		font-size: 0.75rem;
		letter-spacing: 0.02em;
		opacity: 0.72;
		white-space: nowrap;
	}

	:global(.dark) .guest-tag__pending {
		background: rgb(255 255 255 / 0.12);
	}

	.guest-tag__del {
		display: grid;
		place-items: center;
		width: 1.35rem;
		height: 1.35rem;
		border-radius: 0.22rem;
		color: inherit;
		opacity: 0.35;
		transition:
			opacity 0.15s ease-out,
			background-color 0.15s ease-out;
	}

	.guest-tag__del:hover {
		opacity: 0.85;
		background: rgb(0 0 0 / 0.07);
	}

	.guest-tag__del svg {
		width: 1.05rem;
		height: 1.05rem;
	}

	.guest-tag__body {
		font-size: 1rem;
		line-height: 1.72;
		word-break: break-word;
		white-space: normal;
	}

	.guest-tag__foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 0.55rem;
	}

	/* 底栏用原子组件的原始尺寸，不在便签里另调一档：
	   图标、按钮高度、数字字号都跟 atom-action.css 走，全站一致。
	   这里只把左侧多余的胶囊内边距抵掉，让图标和正文左边界对齐 */
	.guest-tag__actions {
		margin-left: -0.55rem;
	}

	.guest-tag__author {
		font-size: 0.9rem;
		font-weight: 600;
		/* 落款吃主题色：换主题色时整墙的签名一起变 */
		color: color-mix(in oklab, var(--primary) 55%, oklch(0.38 0.09 25));
		max-width: 55%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.guest-tag__author.is-owner {
		color: var(--primary);
	}

	/* 便签里的表情图（emojiTokensToHtml 产出的 <img>）需要 :global 才命中 */
	.guest-tag__body :global(.guest-tag__emoji) {
		display: inline-block;
		width: 1.15em;
		height: 1.15em;
		vertical-align: -0.15em;
	}
</style>
