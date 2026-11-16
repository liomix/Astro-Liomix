<script lang="ts">
	/**
	 * 留言墙：把 guestbook 这个 slug 下的评论渲染成一墙便利贴。
	 *
	 * 数据来源就是站内评论后端（comment-client），留言页只是一个换了呈现方式的
	 * 评论区 —— 不新开表、不新开接口。点赞不自己实现：按钮渲染成原子组件的
	 * `[data-like]` 结构，行为由 utils/likes.ts 接管（乐观更新、回滚、动画全在那里）。
	 *
	 * 这一层只管「取数 + 排布 + 写作弹层」；单张纸片是 GuestTag，
	 * 取色 / 类型在 guest-tag.ts。
	 */
	import { onMount, tick } from "svelte";
	import {
		deleteTokenOf,
		forgetOwnComment,
		identityKeyOf,
		rememberOwnComment,
	} from "@/components/common/comment/comment-own";
	import {
		COMMENT_EMAIL_MAX,
		COMMENT_NAME_MAX,
		getCommentUser,
		isValidEmail,
		isValidName,
		setCommentUser,
	} from "@/components/common/comment/comment-user";
	import { registerDynamicLottieIcons } from "@/components/pages/dynamic/dynamic-lottie-icon";
	import { commentApiConfig } from "@/config/commentApiConfig";
	import I18nKey from "@/i18n/i18nKey";
	import { i18n } from "@/i18n/translation";
	import { apiErrorMessage } from "@/utils/api-error-message";
	import {
		deleteComment,
		fetchComments,
		postComment,
		type ApiComment,
	} from "@/utils/comment-client";
	import { formatDateToYYYYMMDD } from "@/utils/date-utils";
	import { registerEmptyLottie } from "@/utils/empty-lottie";
	import { isLikeApiEnabled } from "@/utils/like-client";
	import { bindLikeButtons, syncLikeStates } from "@/utils/likes";
	import { showMessage } from "@/utils/message-pop";
	import GuestTag from "./GuestTag.svelte";
	import type { GuestTagItem } from "./guest-tag";

	interface Props {
		/** 评论线程的 slug，默认就是留言板自己 */
		slug?: string;
	}

	let { slug = "guestbook" }: Props = $props();

	const apiEnabled = commentApiConfig.enable;
	const likeEnabled = isLikeApiEnabled();

	let loading = $state(true);
	let failed = $state(false);
	let notes = $state<GuestTagItem[]>([]);
	/** 下一页游标；null = 已经到底 */
	let cursor = $state<string | null>(null);
	let hasMore = $state(false);
	let loadingMore = $state(false);

	let composerOpen = $state(false);
	let submitting = $state(false);
	/** 正在回复哪一条；null = 新留言 */
	let replyTo = $state<GuestTagItem | null>(null);
	let formName = $state("");
	let formEmail = $state("");
	let formBody = $state("");
	let formError = $state("");

	/** 骨架便签的高度，长短不一才像真的墙 */
	const skeletonHeights = [8, 10.5, 7, 9, 7.5, 11];

	const labels = {
		nameRequired: i18n(I18nKey.commentInfoNameRequired),
		emailInvalid: i18n(I18nKey.commentInfoEmailInvalid),
		bodyRequired: i18n(I18nKey.guestbookBodyRequired),
		deleteConfirm: i18n(I18nKey.guestbookDeleteConfirm),
		submitted: i18n(I18nKey.guestbookSubmitted),
		retractFailed: i18n(I18nKey.commentChatRetractFailed),
		network: i18n(I18nKey.apiErrorNetwork),
		request: i18n(I18nKey.apiErrorRequest),
		server: i18n(I18nKey.apiErrorServer),
		unknown: i18n(I18nKey.apiErrorUnknown),
	};

	function errorText(error: unknown): string {
		return apiErrorMessage(error, {
			network: labels.network,
			request: labels.request,
			server: labels.server,
			unknown: labels.unknown,
		});
	}

	/**
	 * 让点赞模块对齐刚渲染出来的按钮。
	 *
	 * utils/likes 是按 DOM 上的 `[data-like]` 工作的，必须等 Svelte 把节点插进
	 * 文档之后再调一次；已经问过的 id 它自己会跳过，不会重复请求。
	 */
	async function syncLikes(): Promise<void> {
		await tick();
		syncLikeStates();
	}

	/** 一页评论 → 墙上的便签（回复折进父级的计数，不上墙） */
	function toNotes(items: ApiComment[]): GuestTagItem[] {
		// 回复数只能按「这一页看到的」统计：后端按游标分页，拿不到全量
		const replyCount = new Map<string, number>();
		for (const item of items) {
			if (item.parentId) {
				replyCount.set(item.parentId, (replyCount.get(item.parentId) ?? 0) + 1);
			}
		}
		return items
			.filter((item) => !item.parentId)
			.map((item) => ({
				id: item.id,
				body: item.body,
				createdAt: item.createdAt,
				dateLabel: formatDateToYYYYMMDD(item.createdAt),
				author: item.author.name,
				isOwner: item.author.isOwner === true,
				replies: replyCount.get(item.id) ?? 0,
				// 真实点赞数由 utils/likes 批量读回来再画上，这里只给初值
				likes: 0,
				liked: false,
				mine: deleteTokenOf(item.id) !== "",
				pending: item.status !== "approved",
			}));
	}

	async function load(): Promise<void> {
		if (!apiEnabled) {
			loading = false;
			notes = [];
			return;
		}
		loading = true;
		failed = false;
		try {
			const page = await fetchComments(slug);
			cursor = page.nextCursor;
			hasMore = !!page.nextCursor;
			notes = toNotes(page.items);
			await syncLikes();
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	}

	/** 追加更早的一页。游标是「上一页最后一条」，插进来多少都不影响下一页从哪开始 */
	async function loadMore(): Promise<void> {
		if (!cursor || loadingMore) return;
		loadingMore = true;
		try {
			const page = await fetchComments(slug, cursor);
			cursor = page.nextCursor;
			hasMore = !!page.nextCursor;
			notes = [...notes, ...toNotes(page.items)];
			await syncLikes();
		} catch {
			showMessage(labels.network, { type: "error" });
		} finally {
			loadingMore = false;
		}
	}

	function openComposer(): void {
		if (!apiEnabled) {
			showMessage(i18n(I18nKey.commentChatDisabled), { type: "info" });
			return;
		}
		const user = getCommentUser();
		if (user) {
			formName = user.name;
			formEmail = user.email;
		}
		replyTo = null;
		formError = "";
		composerOpen = true;
	}

	/** 评论按钮：开写作层并记住回的是哪一条（parentId） */
	function openReply(note: GuestTagItem): void {
		if (!apiEnabled) {
			showMessage(i18n(I18nKey.commentChatDisabled), { type: "info" });
			return;
		}
		const user = getCommentUser();
		if (user) {
			formName = user.name;
			formEmail = user.email;
		}
		replyTo = note;
		formError = "";
		composerOpen = true;
	}

	function closeComposer(): void {
		if (submitting) return;
		composerOpen = false;
		replyTo = null;
		formError = "";
	}

	async function submit(): Promise<void> {
		const name = formName.trim();
		const email = formEmail.trim();
		const body = formBody.trim();

		if (!isValidName(name)) {
			formError = labels.nameRequired;
			return;
		}
		if (!isValidEmail(email)) {
			formError = labels.emailInvalid;
			return;
		}
		if (!body) {
			formError = labels.bodyRequired;
			return;
		}

		submitting = true;
		formError = "";
		setCommentUser({ name, email });
		try {
			const created = await postComment(slug, {
				author: { name, email },
				body,
				parentId: replyTo?.id,
			});
			// 凭据只在创建响应里出现一次，先落盘再判断要不要上图
			rememberOwnComment(
				created.id,
				created.deleteToken,
				identityKeyOf({ name, email }),
			);

			if (replyTo) {
				// 回复不上墙（墙只放顶层），但父级的评论数要跟着 +1
				const parentId = replyTo.id;
				notes = notes.map((item) =>
					item.id === parentId ? { ...item, replies: item.replies + 1 } : item,
				);
			} else {
				const pending = created.status !== "approved";
				// 待审核也先上图（带标记），刷新后它会消失 —— 这比「发完什么都没发生」可解释
				notes = [
					{
						id: created.id,
						body: created.body,
						createdAt: created.createdAt,
						dateLabel: formatDateToYYYYMMDD(created.createdAt),
						author: created.author.name,
						isOwner: created.author.isOwner === true,
						replies: 0,
						likes: 0,
						liked: false,
						mine: true,
						pending,
					},
					...notes,
				];
				if (pending) {
					showMessage(labels.submitted, { type: "info" });
				}
			}

			formBody = "";
			replyTo = null;
			composerOpen = false;
		} catch (error) {
			formError = errorText(error);
		} finally {
			submitting = false;
		}
	}

	async function remove(note: GuestTagItem): Promise<void> {
		const token = deleteTokenOf(note.id);
		if (!token) return;
		if (!window.confirm(labels.deleteConfirm)) return;
		try {
			await deleteComment(note.id, token);
			forgetOwnComment(note.id);
			notes = notes.filter((item) => item.id !== note.id);
		} catch {
			showMessage(labels.retractFailed, { type: "error" });
		}
	}

	onMount(() => {
		registerEmptyLottie();
		// 爱心 / 气泡是 <dynamic-lottie-icon> 自己画的：先注册元素，再绑点赞委托
		registerDynamicLottieIcons();
		bindLikeButtons();
		void load();

		// Esc 关掉写作层：弹层挡住整页时，键盘用户不该只能找到那个 ×
		const onKeydown = (event: KeyboardEvent): void => {
			if (event.key === "Escape" && composerOpen) closeComposer();
		};
		window.addEventListener("keydown", onKeydown);
		return () => window.removeEventListener("keydown", onKeydown);
	});
</script>

<section class="guestbook-wall" data-guestbook-wall>
	{#if loading}
		<div class="wall" aria-busy="true">
			{#each skeletonHeights as height, index (index)}
				<div
					class="wall-skeleton skeleton"
					style={`--skeleton-height: ${height}rem`}
				></div>
			{/each}
		</div>
	{:else if failed}
		<div class="wall-state">
			<p>{i18n(I18nKey.commentChatLoadFailed)}</p>
			<button type="button" class="wall-retry" onclick={() => load()}>
				{i18n(I18nKey.guestbookRetry)}
			</button>
		</div>
	{:else if notes.length === 0}
		<div class="wall-state">
			<empty-lottie data-animation="utyan_empty"></empty-lottie>
			<p>{i18n(I18nKey.guestbookEmpty)}</p>
			{#if apiEnabled}
				<button type="button" class="wall-retry" onclick={openComposer}>
					{i18n(I18nKey.guestbookWrite)}
				</button>
			{/if}
		</div>
	{:else}
		<div class="wall">
			{#each notes as note (note.id)}
				<GuestTag
					{note}
					{likeEnabled}
					onReply={(target) => openReply(target)}
					onRemove={(target) => void remove(target)}
				/>
			{/each}
		</div>

		{#if hasMore}
			<div class="wall-more">
				<button type="button" disabled={loadingMore} onclick={() => loadMore()}>
					{loadingMore
						? i18n(I18nKey.commentChatLoading)
						: i18n(I18nKey.commentChatLoadMore)}
				</button>
			</div>
		{/if}
	{/if}

	{#if apiEnabled}
		<button
			type="button"
			class="wall-fab"
			aria-label={i18n(I18nKey.guestbookWrite)}
			title={i18n(I18nKey.guestbookWrite)}
			onclick={openComposer}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M12 5v14M5 12h14"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	{/if}

	{#if composerOpen}
		<div class="composer-layer">
			<form
				class="composer"
				onsubmit={(event) => {
					event.preventDefault();
					void submit();
				}}
			>
				<header class="composer-head">
					<h2>
						{replyTo
							? `${i18n(I18nKey.commentChatReply)} @${replyTo.author}`
							: i18n(I18nKey.guestbookWrite)}
					</h2>
					<button
						type="button"
						class="composer-close"
						aria-label={i18n(I18nKey.commentInfoCancel)}
						onclick={closeComposer}
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
				</header>

				<div class="composer-row">
					<label class="composer-field">
						<span>{i18n(I18nKey.commentInfoName)}</span>
						<input
							type="text"
							bind:value={formName}
							maxlength={COMMENT_NAME_MAX}
							placeholder={i18n(I18nKey.commentInfoNamePlaceholder)}
							autocomplete="nickname"
							required
						/>
					</label>
					<label class="composer-field">
						<span>{i18n(I18nKey.commentInfoEmail)}</span>
						<input
							type="email"
							bind:value={formEmail}
							maxlength={COMMENT_EMAIL_MAX}
							placeholder={i18n(I18nKey.commentInfoEmailPlaceholder)}
							autocomplete="email"
							required
						/>
					</label>
				</div>

				<label class="composer-field composer-field--body">
					<span class="sr-only">
						{replyTo
							? i18n(I18nKey.commentChatReply)
							: i18n(I18nKey.guestbookWrite)}
					</span>
					<textarea
						bind:value={formBody}
						rows="5"
						maxlength="1000"
						placeholder={i18n(I18nKey.commentChatPlaceholder)}
						required
					></textarea>
				</label>

				{#if formError}
					<p class="composer-error" role="alert">{formError}</p>
				{/if}

				<footer class="composer-foot">
					<button type="button" class="composer-cancel" onclick={closeComposer}>
						{i18n(I18nKey.commentInfoCancel)}
					</button>
					<button type="submit" class="composer-send" disabled={submitting}>
						{i18n(I18nKey.commentChatSend)}
					</button>
				</footer>
			</form>
		</div>
	{/if}
</section>

<style>
	.guestbook-wall {
		position: relative;
		/* 父级是「锁定视口高度 + 内部滚动」的 flex 列：默认 flex-shrink 会把墙压扁
		   而不是让它溢出滚动，所以这里明确不参与收缩 */
		flex: none;
	}

	/* 瀑布流：多列按内容高度自然堆叠。列宽 16rem，宽屏自动多开几列，
	   便签高度差靠 break-inside 保住，不会被拦腰截断。 */
	.wall {
		columns: 17rem;
		column-gap: 0.75rem;
	}

	/* 骨架块：形状和真便签一致（同列宽、同圆角），内容用 skeleton 的灰底 */
	.wall-skeleton {
		break-inside: avoid;
		margin-bottom: 0.75rem;
		border-radius: 0.25rem;
	}

	.wall-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 2.5rem 1rem;
		border-radius: var(--radius-large);
		background: color-mix(in srgb, var(--card-bg) 75%, transparent);
		text-align: center;
		color: var(--content-meta);
		font-size: 0.9rem;
	}

	.wall-state :global(empty-lottie) {
		width: clamp(88px, 16vw, 128px);
		height: clamp(88px, 16vw, 128px);
	}

	.wall-retry {
		padding: 0.4rem 1rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--primary) 12%, transparent);
		color: var(--primary);
		font-size: 0.85rem;
	}

	.wall-more {
		display: flex;
		justify-content: center;
		margin: 0.25rem 0 1.5rem;
	}

	.wall-more button {
		padding: 0.45rem 1.3rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--primary) 10%, transparent);
		color: var(--primary);
		font-size: 0.85rem;
		transition: background-color 0.15s ease-out;
	}

	.wall-more button:hover:not(:disabled) {
		background: color-mix(in srgb, var(--primary) 16%, transparent);
	}

	.wall-more button:disabled {
		opacity: 0.6;
	}

	/* 新建留言：和右下角那组浮动按钮同一个定位域，往上错开一个按钮位 */
	.wall-fab {
		position: fixed;
		z-index: 1000;
		right: 1rem;
		bottom: 7.5rem;
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		border-radius: 999px;
		/* 按钮吃主题色（用户口径） */
		background: var(--primary);
		color: white;
		box-shadow:
			0 2px 6px rgb(0 0 0 / 0.18),
			0 8px 22px color-mix(in srgb, var(--primary) 35%, transparent);
		transition:
			transform 0.18s ease-out,
			filter 0.18s ease-out;
	}

	.wall-fab:hover {
		transform: translateY(-2px);
		filter: brightness(1.06);
	}

	.wall-fab:active {
		transform: translateY(0);
	}

	.wall-fab svg {
		width: 1.35rem;
		height: 1.35rem;
	}

	@media (max-width: 768px) {
		.wall-fab {
			right: 0.75rem;
			bottom: 7rem;
		}
	}

	/* 写作层 */
	.composer-layer {
		position: fixed;
		inset: 0;
		z-index: 1100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: rgb(0 0 0 / 0.32);
		backdrop-filter: blur(3px);
	}

	.composer {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		width: min(28rem, 100%);
		max-height: min(90vh, 40rem);
		overflow-y: auto;
		padding: 1.1rem 1.15rem 1rem;
		border-radius: var(--radius-large);
		background: var(--card-bg);
		box-shadow: 0 18px 48px rgb(0 0 0 / 0.28);
		color: var(--deep-text);
		/* 写长了要能滚，但滚动条 UI 不露出来 */
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.composer::-webkit-scrollbar {
		display: none;
		width: 0;
		height: 0;
	}

	.composer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.composer-head h2 {
		font-size: 1rem;
		font-weight: 700;
	}

	.composer-close {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 0.4rem;
		color: inherit;
		opacity: 0.6;
	}

	.composer-close:hover {
		opacity: 1;
		background: var(--btn-regular-bg);
	}

	.composer-close svg {
		width: 1rem;
		height: 1rem;
	}

	.composer-row {
		display: flex;
		gap: 0.6rem;
	}

	.composer-field {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
		font-size: 0.78rem;
		color: var(--content-meta);
	}

	.composer-field input,
	.composer-field textarea {
		width: 100%;
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--line-color);
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--card-bg) 92%, var(--btn-regular-bg));
		color: var(--deep-text);
		font-size: 0.85rem;
		line-height: 1.6;
		outline: none;
		transition: border-color 0.15s ease-out;
	}

	.composer-field input:focus,
	.composer-field textarea:focus {
		border-color: var(--primary);
	}

	.composer-field textarea {
		resize: vertical;
		min-height: 6rem;
	}

	.composer-error {
		font-size: 0.78rem;
		color: oklch(0.58 0.18 25);
	}

	.composer-foot {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.composer-cancel,
	.composer-send {
		padding: 0.45rem 1.05rem;
		border-radius: 999px;
		font-size: 0.85rem;
		transition:
			background-color 0.15s ease-out,
			filter 0.15s ease-out;
	}

	.composer-cancel {
		background: var(--btn-regular-bg);
		color: var(--btn-content);
	}

	.composer-send {
		background: var(--primary);
		color: white;
	}

	.composer-send:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
