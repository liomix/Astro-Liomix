<script lang="ts">
/**
 * 图书详情弹窗（3D 书架里点「已经滑出来的那本书」时弹出）
 * ----------------------------------------------------------------------------
 * 原生 <dialog>。布局是两行网格：
 *   第一行  封面 | 标题·作者·字数评分 + 关闭按钮
 *   第二行  横跨整行的简介（上面一条细分割线）
 * 关闭按钮是网格里的普通 flex 项，不参与绝对定位，所以封面比例怎么变它都不乱跑。
 *
 * 背景：封面自身放大 + 高斯模糊，再压一层深色半透明（scrim），
 * 颜色透得出来、上面的白字也始终读得清（浅色封面对白字同样安全）。
 */
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";

interface BookInfo {
	id: string;
	title: string;
	author: string;
	cover: string;
	/** 书籍简介，可能为空 */
	intro: string;
	/** 预格式化的字数，如「22.4 万字」 */
	wordsText: string;
	/** 预格式化的评分，如「9.1 分」 */
	scoreText: string;
	/** 预格式化的评分人数标签，如「2376人评分」，空串表示没取到 */
	ratingLabel?: string;
}

interface Props {
	/** 要展示的书；null 表示关闭 */
	book: BookInfo | null;
	onClose: () => void;
}

let { book, onClose }: Props = $props();

const closeLabel = i18n(I18nKey.announcementClose);
/** 信息栏三个字段的小标题 */
const authorLabel = i18n(I18nKey.author);
const wordsLabel = i18n(I18nKey.booksWordsLabel);
const scoreLabel = i18n(I18nKey.booksScoreLabel);

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

/**
 * 单行文本超宽时循环滚动。
 * 轨道里放了两份同样的文字，第一份带右内边距；滚过「一份宽」后画面正好接上，
 * 所以能无缝无限循环。没超宽就只显示第一份，完全静止。
 */
function marquee(node: HTMLElement) {
	let frame = 0;
	let dead = false;

	const measure = () => {
		if (dead) return;
		const content = node.querySelector<HTMLElement>(".marquee-track > span");
		if (!content) return;
		const gap = Number.parseFloat(getComputedStyle(content).paddingRight) || 0;
		const textWidth = content.offsetWidth - gap;
		const over = textWidth > node.clientWidth + 1;
		node.classList.toggle("is-scrolling", over);
		if (!over) return;
		node.style.setProperty("--marquee-shift", `-${content.offsetWidth}px`);
		node.style.setProperty(
			"--marquee-dur",
			`${Math.max(6, content.offsetWidth / 26).toFixed(1)}s`,
		);
	};

	const schedule = () => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(measure);
	};

	measure();
	// 字体、图片加载完宽度会变，再量一次
	if (document.fonts) void document.fonts.ready.then(schedule);
	const observer = new ResizeObserver(schedule);
	observer.observe(node);

	return {
		destroy() {
			dead = true;
			cancelAnimationFrame(frame);
			observer.disconnect();
		},
	};
}

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
	{#if shown?.cover}
		<div
			class="book-pop-blur"
			style={`background-image:url(${JSON.stringify(shown.cover)})`}
			aria-hidden="true"
		></div>
	{/if}

	{#if shown}
		{#key shown.id}
			<div class="book-pop-scroll">
				<div class="book-pop-grid">
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

					<div class="book-pop-head">
						<div class="book-pop-col">
							<h2 class="book-pop-title scroll-line" id="book-pop-title" use:marquee>
								<span class="marquee-track">
									<span>{shown.title}</span>
									<span aria-hidden="true">{shown.title}</span>
								</span>
							</h2>

							<div class="book-pop-fields">
								{#if shown.author}
									<div class="book-pop-field">
										<span class="book-pop-label">{authorLabel}</span>
										<span class="book-pop-value scroll-line" use:marquee>
											<span class="marquee-track">
												<span>{shown.author}</span>
												<span aria-hidden="true">{shown.author}</span>
											</span>
										</span>
									</div>
								{/if}

								{#if shown.wordsText}
									<div class="book-pop-field">
										<span class="book-pop-label">{wordsLabel}</span>
										<span class="book-pop-value">{shown.wordsText}</span>
									</div>
								{/if}

								{#if shown.scoreText}
									<div class="book-pop-field">
										<span class="book-pop-label">{shown.ratingLabel || scoreLabel}</span>
										<span class="book-pop-value book-pop-value-score">
											<svg class="book-pop-star" viewBox="0 0 24 24" aria-hidden="true">
												<path
													d="M12 2.6l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.62l-5.88 3.09 1.12-6.55L2.48 9.52l6.58-.96z"
												/>
											</svg>
											{shown.scoreText}
										</span>
									</div>
								{/if}
							</div>
						</div>

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
					</div>

					{#if shown.intro}
						<p class="book-pop-intro">{shown.intro}</p>
					{/if}
				</div>
			</div>
		{/key}
	{/if}
</dialog>

<style>
	/* 弹窗打开时锁住页面滚动 */
	:global(body:has(.book-pop[open])) {
		overflow: hidden;
	}

	.book-pop {
		/* 白字 + 深色蒙版：任何封面上都读得清，颜色又透得出来 */
		--pop-ink: rgb(255 255 255 / 0.97);
		--pop-ink-2: rgb(255 255 255 / 0.84);
		--pop-ink-3: rgb(255 255 255 / 0.7);
		--pop-scrim: rgb(10 11 15 / 0.56);
		--pop-edge: rgb(255 255 255 / 0.14);

		/* 不要覆盖 UA 的 position：模态 dialog 默认 fixed，定位靠 inset + margin */
		width: min(88vw, 26rem);
		max-width: min(88vw, 26rem);
		/* 竖长卡片：高度固定，且始终大于宽度 */
		height: min(88vh, 34rem);
		inset: 0;
		/* 中上弹出：上边留 7vh，左右自动居中，下方留空 */
		margin: 7vh auto auto;
		padding: 0;
		border: 1px solid var(--pop-edge);
		border-radius: 1.35rem;
		background: rgb(14 15 20);
		box-shadow:
			0 36px 80px -20px rgb(0 0 0 / 0.7),
			inset 0 1px 0 rgb(255 255 255 / 0.08);
		display: flex;
		flex-direction: column;
		color: var(--pop-ink);
		overflow: hidden;
		isolation: isolate;
	}

	:global(:root.dark) .book-pop {
		--pop-scrim: rgb(5 5 8 / 0.62);
	}

	.book-pop:not([open]) {
		display: none;
	}

	/* 只改弹窗本身：遮罩保持原来那层淡深色，不碰页面 */
	.book-pop::backdrop {
		background: rgb(8 10 14 / 0.52);
		backdrop-filter: blur(3px);
	}

	/* ── 背景：封面放大后重度高斯模糊，再压一层深色 ── */
	.book-pop-blur {
		position: absolute;
		inset: -30%;
		z-index: -1;
		background-position: center;
		background-size: cover;
		filter: blur(64px) saturate(1.75);
		transform: scale(1.12);
		pointer-events: none;
	}

	.book-pop::before {
		position: absolute;
		inset: 0;
		/* 中心稍亮、四周压暗，模糊铺开后不至于糊成一块死板的灰 */
		background:
			radial-gradient(130% 110% at 38% 32%, transparent 0%, rgb(0 0 0 / 0.28) 100%),
			var(--pop-scrim);
		content: "";
		pointer-events: none;
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

	.book-pop-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	/* ── 两行网格：封面｜标题区 + 关闭 → 简介（横跨整行） ── */
	.book-pop-grid {
		position: relative;
		display: grid;
		/* 第一列必须是定长：写成 auto 时，带百分比宽度的封面会让列宽按图片原始宽度撑开，
		   结果封面缩在左边、右边留一大块空白。 */
		grid-template-columns: 9rem minmax(0, 1fr);
		grid-template-areas:
			"cover head"
			"intro intro";
		align-items: start;
		gap: 0.95rem 1.4rem;
		padding: 1.3rem 1.35rem 1.35rem;
	}

	.book-pop-cover {
		grid-area: cover;
		align-self: start;
		width: 100%;
		margin: 0;
		overflow: hidden;
		border-radius: 0.6rem;
		background: rgb(255 255 255 / 0.08);
		box-shadow:
			0 0 0 1px rgb(255 255 255 / 0.12),
			0 16px 30px -14px rgb(0 0 0 / 0.7);
	}

	/* 保持封面原始比例，不裁切 */
	.book-pop-cover img {
		display: block;
		width: 100%;
		height: auto;
	}

	.book-pop-cover-blank {
		display: grid;
		aspect-ratio: 3 / 4;
		place-items: center;
		color: var(--pop-ink-3);
		font-size: 1.4rem;
	}

	.book-pop-head {
		grid-area: head;
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		min-width: 0;
	}

	.book-pop-col {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.6rem;
		min-width: 0;
	}

	/* ── 信息栏：小标题 + 大数值，三段纵向排开 ── */
	.book-pop-fields {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		min-width: 0;
	}

	.book-pop-field {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.book-pop-label {
		color: var(--pop-ink-3);
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.1em;
		line-height: 1.5;
	}

	.book-pop-value {
		color: var(--pop-ink);
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		line-height: 1.35;
		font-variant-numeric: tabular-nums;
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.42);
	}

	.book-pop-value-score {
		display: flex;
		align-items: center;
		gap: 0.34rem;
	}

	.book-pop-star {
		width: 1rem;
		height: 1rem;
		fill: #f7c546;
		filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.35));
	}

	/* ── 单行滚动行 ── */
	.scroll-line {
		display: block;
		max-width: 100%;
		margin: 0;
		overflow: hidden;
		white-space: nowrap;
	}

	/* 滚动时右侧淡出，长文本看起来是「流出去」而不是被切断。
	   is-scrolling 由 action 在运行时加，编译器看不到，所以用 :global 声明 */
	:global(.scroll-line.is-scrolling) {
		mask-image: linear-gradient(90deg, #000 calc(100% - 1.4rem), transparent);
	}

	.marquee-track {
		display: inline-flex;
		align-items: baseline;
	}

	.marquee-track > span {
		flex: none;
		/* 两段文字之间的接缝，滚动位移正好等于「一段宽 + 这个间距」 */
		padding-right: 2.5rem;
	}

	/* 没超宽：只留第一份，静止显示 */
	.scroll-line:not(.is-scrolling) .marquee-track > span:nth-child(2) {
		display: none;
	}

	:global(.scroll-line.is-scrolling .marquee-track) {
		animation: book-pop-marquee var(--marquee-dur, 12s) linear infinite;
	}

	@keyframes book-pop-marquee {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(var(--marquee-shift, -50%));
		}
	}

	.book-pop-title {
		color: var(--pop-ink);
		font-size: 1.3rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		line-height: 1.35;
		text-shadow: 0 1px 2px rgb(0 0 0 / 0.45);
	}

	/* 简介是唯一允许换行的行，横跨整宽 */
	.book-pop-intro {
		display: -webkit-box;
		grid-area: intro;
		margin: 0.55rem 0 0;
		overflow: hidden;
		color: var(--pop-ink-2);
		font-size: 0.92rem;
		line-height: 1.8;
		white-space: normal;
		text-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 10;
		line-clamp: 10;
	}

	.book-pop-close {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.9rem;
		height: 1.9rem;
		padding: 0;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 9999px;
		background: rgb(255 255 255 / 0.1);
		color: var(--pop-ink-2);
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.book-pop-close:hover {
		background: rgb(255 255 255 / 0.2);
		color: var(--pop-ink);
	}

	.book-pop-close svg {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}

	.book-pop-close:focus-visible {
		outline: 2px solid rgb(255 255 255 / 0.7);
		outline-offset: 2px;
	}

	@media (max-width: 480px) {
		.book-pop-grid {
			grid-template-columns: 6.5rem minmax(0, 1fr);
			gap: 0.8rem 1rem;
			padding: 1.05rem 1.05rem 1.1rem;
		}

		.book-pop-title {
			font-size: 1.05rem;
		}

		.book-pop-fields {
			gap: 0.55rem;
		}

		.book-pop-label {
			font-size: 0.64rem;
		}

		.book-pop-value {
			font-size: 0.95rem;
		}

		.book-pop-star {
			width: 0.9rem;
			height: 0.9rem;
		}

		.book-pop-intro {
			font-size: 0.86rem;
			-webkit-line-clamp: 8;
			line-clamp: 8;
		}

		.book-pop-close {
			width: 1.7rem;
			height: 1.7rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.book-pop[open] {
			animation: none;
		}

		:global(.scroll-line.is-scrolling .marquee-track) {
			animation: none;
		}
	}
</style>
