<script lang="ts">
/**
 * 留言墙：把 guestbook 这个 slug 下的评论渲染成一墙便利贴。
 *
 * 数据来源就是站内评论后端（comment-client），留言页只是一个换了呈现方式的
 * 评论区 —— 不新开表、不新开接口。点赞不自己实现：按钮渲染成原子组件的
 * `[data-like]` 结构，行为由 utils/likes.ts 接管（乐观更新、回滚、动画全在那里）。
 *
 * 这一层只管「取数 + 排布 + 写作弹层」；单张纸片是 GuestTag，
 * 取色 / 类型在 guestbook-tag.ts。
 */
import { onMount, tick } from "svelte";
import type { GuestTagItem } from "@/features/navigation/guestbook/lib/guest-tag";
import {
	bindCommentDrawer,
	COMMENT_EMAIL_MAX,
	COMMENT_NAME_MAX,
	deleteTokenOf,
	forgetOwnComment,
	getCommentUser,
	identityKeyOf,
	isValidEmail,
	isValidName,
	openCommentDrawer,
	rememberOwnComment,
	setCommentUser,
} from "@/shared/components/comments";
import { registerEmptyLottie } from "@/shared/components/ui/empty-lottie";
import { registerDynamicLottieIcons } from "@/shared/components/ui/lottie-icon";
import I18nKey from "@/shared/i18n/i18nKey";
import { i18n } from "@/shared/i18n/translation";
import {
	type ApiComment,
	deleteComment,
	fetchComments,
	postComment,
} from "@/shared/lib/comments/comment-client";
import {
	COMMENT_MSG,
	COMMENT_MSG_VERSION,
} from "@/shared/lib/comments/comment-postmessage";
import {
	commentApiConfig,
	commentEmojiConfig,
} from "@/shared/lib/comments/config";
import {
	emojiTokenOfSrc,
	emojiTokenPattern,
	resolveEmojiToken,
} from "@/shared/lib/comments/emoji-shortcode";
import { formatDateToYYYYMMDD } from "@/shared/lib/format/date";
import { apiErrorMessage } from "@/shared/lib/http/api-error-message";
import { isLikeApiEnabled } from "@/shared/lib/likes/like-client";
import { bindLikeButtons, syncLikeStates } from "@/shared/lib/likes/likes";
import { showMessage } from "@/shared/lib/message-pop";
import type { CommentEmojiItem } from "@/shared/types/comments";
import GuestTag from "./GuestTag.svelte";

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
let formName = $state("");
let formEmail = $state("");
let formError = $state("");
/** 编辑器纯文本长度：挡「表情把 1000 字顶爆」，也用来判断正文是否为空 */
let bodyLength = $state(0);

/* 表情面板：数据与评论区共用 commentEmojiConfig，一份配置两处使用 */
const packs = commentEmojiConfig.packs;
const bodyMax = 1000;
let emojiOpen = $state(false);
let activePackId = $state(packs[0]?.id ?? "");
let editorEl = $state<HTMLElement | null>(null);

/** 当前系列；配置为空时是 undefined，面板整块不渲染 */
const activePack = $derived(
	packs.find((pack) => pack.id === activePackId) ?? packs[0],
);

/**
 * 当前抽屉里那条留言。
 * 抽屉里的 iframe 是独立文档，拿不到这里的数据，所以它加载完会发
 * `guest-parent-request` 来要一次（见 onThreadMessage）。
 */
let activeParent: GuestTagItem | null = null;

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

/**
 * 把编辑器内容读回源文本：文字原样、`<br>` 转换行、表情图转短码。
 *
 * 与 Comment.astro 的 readComposer 同一套规则 —— 两边发出去的都是短码，
 * 渲染端只需认一种格式。认不出来的图片直接丢掉：输入框里只该有表情图，
 * 一张来路不明的图没有对应的文字表达，写进正文就是坏数据。
 */
function readComposer(root: HTMLElement): string {
	let out = "";
	const walk = (node: Node): void => {
		for (const child of Array.from(node.childNodes)) {
			if (child.nodeType === Node.TEXT_NODE) {
				out += (child.textContent ?? "").replace(/\u00a0/g, " ");
				continue;
			}
			if (child.nodeName === "BR") {
				out += "\n";
				continue;
			}
			if (child instanceof HTMLImageElement) {
				const token =
					child.dataset.tgEmojiToken ??
					emojiTokenOfSrc(
						child.dataset.tgEmojiSrc ?? child.getAttribute("src") ?? "",
					);
				if (token) out += token;
				continue;
			}
			walk(child);
		}
	};
	walk(root);
	return out;
}

/**
 * 用源文本重建编辑器内容。
 *
 * 为什么不在光标处直接 insertNode：Chrome 会给 contenteditable 补占位 `<br>`，
 * 直接插图之后那个 br 就卡在两张图中间 —— 表情会一张一行地竖着排。
 * 改成「读源文本 → 整块重建」，DOM 结构永远只有三样：文本、`<br>`、表情图，
 * 不会再有浏览器自己加的节点。
 */
function renderSource(text: string): void {
	const root = editorEl;
	if (!root) return;

	const frag = document.createDocumentFragment();
	const pattern = emojiTokenPattern();
	let last = 0;

	const appendText = (chunk: string): void => {
		chunk.split("\n").forEach((part, index) => {
			if (index > 0) frag.append(document.createElement("br"));
			if (part) frag.append(document.createTextNode(part));
		});
	};

	for (const match of text.matchAll(pattern)) {
		const index = match.index ?? 0;
		appendText(text.slice(last, index));
		const emoji = resolveEmojiToken(match[0]);
		if (emoji) {
			const img = document.createElement("img");
			img.src = emoji.src;
			img.alt = emoji.alt;
			img.className = "composer-input__emoji";
			img.dataset.tgEmojiToken = match[0];
			frag.append(img);
		} else {
			appendText(match[0]);
		}
		last = index + match[0].length;
	}
	appendText(text.slice(last));

	root.replaceChildren(frag);
}

/** 光标在源文本里的偏移：把「内容起点到光标」这段复制出来，按 readComposer 量长度 */
function caretOffset(): number {
	const root = editorEl;
	const selection = window.getSelection();
	if (!root || !selection || selection.rangeCount === 0) return bodyLength;

	const range = selection.getRangeAt(0);
	if (!root.contains(range.startContainer)) return bodyLength;

	const before = range.cloneRange();
	before.selectNodeContents(root);
	before.setEnd(range.startContainer, range.startOffset);

	const holder = document.createElement("div");
	holder.append(before.cloneContents());
	return readComposer(holder).length;
}

/** 把光标放回源文本的某个偏移上（表情图按短码长度算一格） */
function setCaretAt(offset: number): void {
	const root = editorEl;
	const selection = window.getSelection();
	if (!root || !selection) return;

	let remain = offset;
	const range = document.createRange();

	const walk = (parent: Node): boolean => {
		for (const child of Array.from(parent.childNodes)) {
			if (child.nodeType === Node.TEXT_NODE) {
				const text = child.textContent ?? "";
				if (remain <= text.length) {
					range.setStart(child, remain);
					return true;
				}
				remain -= text.length;
				continue;
			}
			if (child.nodeName === "BR") {
				if (remain === 0) {
					range.setStartBefore(child);
					return true;
				}
				remain -= 1;
				continue;
			}
			if (child instanceof HTMLImageElement) {
				const length = (child.dataset.tgEmojiToken ?? "").length;
				if (remain <= length) {
					// 落在短码范围内：光标放到图后面，接着写就接在这张图之后
					range.setStartAfter(child);
					return true;
				}
				remain -= length;
				continue;
			}
			if (walk(child)) return true;
		}
		return false;
	};

	if (walk(root)) range.collapse(true);
	else {
		// 偏移到底（或结构不认识）：光标放末尾
		range.selectNodeContents(root);
		range.collapse(false);
	}
	selection.removeAllRanges();
	selection.addRange(range);
}

/** 在光标处插一段**源文本**（换行、粘贴、表情短码都走这里），然后重建 */
function insertTextAtCaret(chunk: string): void {
	const root = editorEl;
	if (!root) return;
	const text = readComposer(root);
	const at = caretOffset();
	const next = text.slice(0, at) + chunk + text.slice(at);

	renderSource(next);
	bodyLength = next.length;
	if (formError) formError = "";
	root.focus({ preventScroll: true });
	setCaretAt(at + chunk.length);
}

function syncBody(): void {
	if (!editorEl) return;
	bodyLength = readComposer(editorEl).length;
	if (formError) formError = "";
}

// contenteditable 默认会把剪贴板里的整段 HTML 塞进来（样式、链接全跟着进来），
// 只收纯文本
function onPaste(event: ClipboardEvent): void {
	const text = event.clipboardData?.getData("text/plain");
	if (text == null) return;
	event.preventDefault();
	insertTextAtCaret(text);
}

// Enter 换行、Ctrl/⌘+Enter 发送。默认行为会插 <div> 或 <br>，两种都可能；
// 自己走源文本，重建之后只会有一种结构
function onKeydown(event: KeyboardEvent): void {
	if (event.key !== "Enter" || event.isComposing) return;
	if (event.ctrlKey || event.metaKey) {
		event.preventDefault();
		void submit();
		return;
	}
	event.preventDefault();
	insertTextAtCaret("\n");
}

/**
 * 把表情插到光标处：输入框里放的是**图**（短码只是发送时的载体）。
 * 尺寸统一取 commentEmojiConfig.size（24px），和评论区气泡里一致。
 */
function insertEmoji(item: CommentEmojiItem): void {
	const token = emojiTokenOfSrc(item.src);
	if (!token) return;
	if (bodyLength + token.length > bodyMax) return;
	insertTextAtCaret(token);
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
	formError = "";
	emojiOpen = false;
	composerOpen = true;
}

/**
 * 评论按钮：从右侧抽出这条留言的评论抽屉。
 *
 * 抽屉里装的是 `/guestbook/thread/`，线程 slug 由 path 推出来
 * （`/guestbook/<id>/` → `guestbook-<id>`）；被评论的那条留言由本页在
 * iframe 就绪后 postMessage 递过去，所以抽屉一打开就能看到「在评论什么」。
 */
function openReply(note: GuestTagItem, trigger: HTMLElement): void {
	if (!apiEnabled) {
		showMessage(i18n(I18nKey.commentChatDisabled), { type: "info" });
		return;
	}
	activeParent = note;
	const path = `/guestbook/${encodeURIComponent(note.id)}/`;
	openCommentDrawer(
		`/guestbook/thread/?embed=1&path=${encodeURIComponent(path)}`,
		trigger,
	);
}

function closeComposer(): void {
	if (submitting) return;
	composerOpen = false;
	emojiOpen = false;
	formError = "";
}

async function submit(): Promise<void> {
	const name = formName.trim();
	const email = formEmail.trim();
	const body = (editorEl ? readComposer(editorEl) : "").trim();

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
		const created = await postComment(slug, { author: { name, email }, body });
		// 凭据只在创建响应里出现一次，先落盘再判断要不要上图
		rememberOwnComment(
			created.id,
			created.deleteToken,
			identityKeyOf({ name, email }),
		);

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

		if (editorEl) editorEl.innerHTML = "";
		bodyLength = 0;
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

/**
 * 抽屉里的 iframe 是独立文档，拿不到这里的 notes —— 它加载完会来要一次
 * 父留言（`guest-parent-request`），这边把当前那条回过去。
 */
function onThreadMessage(event: MessageEvent): void {
	if (event.origin !== window.location.origin) return;
	if (event.data?.type !== COMMENT_MSG.parentRequest) return;
	const parent = activeParent;
	const frame = document.querySelector<HTMLIFrameElement>(
		".comment-drawer-frame",
	);
	if (!parent || !frame?.contentWindow) return;
	frame.contentWindow.postMessage(
		{
			type: COMMENT_MSG.parent,
			version: COMMENT_MSG_VERSION,
			parent: {
				author: parent.author,
				dateLabel: parent.dateLabel,
				body: parent.body,
			},
		},
		window.location.origin,
	);
}

onMount(() => {
	registerEmptyLottie();
	// 爱心 / 气泡是 <dynamic-lottie-icon> 自己画的：先注册元素，再绑点赞委托
	registerDynamicLottieIcons();
	bindLikeButtons();
	// 评论抽屉的外壳与全局事件（点外面收起、Esc、iframe 里的关闭按钮）
	bindCommentDrawer();
	window.addEventListener("message", onThreadMessage);
	void load();

	// Esc 关掉写作层：弹层挡住整页时，键盘用户不该只能找到那个 ×
	const onKeydown = (event: KeyboardEvent): void => {
		if (event.key === "Escape" && composerOpen) closeComposer();
	};
	window.addEventListener("keydown", onKeydown);
	return () => {
		window.removeEventListener("keydown", onKeydown);
		window.removeEventListener("message", onThreadMessage);
	};
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
			<empty-lottie data-animation="empty"></empty-lottie>
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
					onReply={(target, trigger) => openReply(target, trigger)}
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
				style={`--composer-emoji-size: ${commentEmojiConfig.size}px`}
				onsubmit={(event) => {
					event.preventDefault();
					void submit();
				}}
			>
				<header class="composer-head">
					<h2>{i18n(I18nKey.guestbookWrite)}</h2>
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

				<div class="composer-field composer-field--body">
					<!-- contenteditable 而不是 textarea：表情要在这里直接画成图，
					     文本域只能显示短码。发出去的仍然是短码（readComposer） -->
					<div
						class="composer-input"
						contenteditable="true"
						role="textbox"
						aria-multiline="true"
						tabindex="0"
						aria-label={i18n(I18nKey.guestbookWrite)}
						data-placeholder={i18n(I18nKey.commentChatPlaceholder)}
						bind:this={editorEl}
						oninput={() => syncBody()}
						onpaste={onPaste}
						onkeydown={onKeydown}
					></div>
				</div>

				{#if emojiOpen && activePack}
					<div class="composer-emoji">
						{#if packs.length > 1}
							<div class="composer-emoji-tabs" role="tablist">
								{#each packs as pack (pack.id)}
									<button
										type="button"
										role="tab"
										class="composer-emoji-tab"
										class:is-active={pack.id === activePack.id}
										aria-selected={pack.id === activePack.id}
										onclick={() => (activePackId = pack.id)}
									>
										{pack.label}
									</button>
								{/each}
							</div>
						{/if}
						<div class="composer-emoji-grid">
							{#each activePack.items as item (item.id)}
								<button
									type="button"
									class="composer-emoji-item"
									title={item.name}
									aria-label={item.name}
									onmousedown={(event) => event.preventDefault()}
									onclick={() => insertEmoji(item)}
								>
									<img
										src={item.src}
										alt=""
										loading="lazy"
										decoding="async"
									/>
								</button>
							{/each}
						</div>
					</div>
				{/if}

				{#if formError}
					<p class="composer-error" role="alert">{formError}</p>
				{/if}

				<footer class="composer-foot">
					<button
						type="button"
						class="composer-emoji-toggle"
						class:is-active={emojiOpen}
						aria-label={i18n(I18nKey.commentChatEmoji)}
						title={i18n(I18nKey.commentChatEmoji)}
						aria-expanded={emojiOpen}
						onclick={() => (emojiOpen = !emojiOpen)}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<circle
								cx="12"
								cy="12"
								r="9"
								fill="none"
								stroke="currentColor"
								stroke-width="1.6"
							/>
							<path
								d="M8.5 14.5a4.2 4.2 0 0 0 7 0"
								fill="none"
								stroke="currentColor"
								stroke-width="1.6"
								stroke-linecap="round"
							/>
							<circle cx="9.2" cy="9.6" r="1.1" fill="currentColor" />
							<circle cx="14.8" cy="9.6" r="1.1" fill="currentColor" />
						</svg>
					</button>

					<div class="composer-actions">
						<button type="button" class="composer-cancel" onclick={closeComposer}>
							{i18n(I18nKey.commentInfoCancel)}
						</button>
						<button type="submit" class="composer-send" disabled={submitting}>
							{i18n(I18nKey.commentChatSend)}
						</button>
					</div>
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
	.composer-field .composer-input {
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
	.composer-field .composer-input:focus {
		border-color: var(--primary);
	}

	/* 正文编辑器：多行、自己滚，空的时候显示占位文字 */
	.composer-input {
		min-height: 6.5rem;
		max-height: 12rem;
		overflow-y: auto;
		white-space: pre-wrap;
		word-break: break-word;
		cursor: text;
		scrollbar-width: none;
	}

	.composer-input::-webkit-scrollbar {
		display: none;
	}

	.composer-input:empty::before {
		content: attr(data-placeholder);
		color: var(--content-meta);
		opacity: 0.7;
		pointer-events: none;
	}

	/* 表情图是脚本创建后插进来的节点，没有作用域类，只能用 :global。
	   尺寸统一吃 commentEmojiConfig.size（24px），和评论区那张一样大。
	   display 必须显式写：Tailwind Preflight 把 img 设成了 block，
	   不覆盖的话每张图会独占一行（竖着排下去） */
	.composer-input :global(.composer-input__emoji) {
		display: inline-block;
		width: var(--composer-emoji-size, 24px);
		height: var(--composer-emoji-size, 24px);
		margin: 0 0.06rem;
		object-fit: contain;
		vertical-align: -0.28em;
	}

	.composer-error {
		font-size: 0.78rem;
		color: oklch(0.58 0.18 25);
	}

	.composer-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.composer-actions {
		display: flex;
		gap: 0.5rem;
	}

	.composer-emoji-toggle {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		color: var(--content-meta);
		transition:
			background-color 0.15s ease-out,
			color 0.15s ease-out;
	}

	.composer-emoji-toggle:hover,
	.composer-emoji-toggle.is-active {
		background: var(--btn-regular-bg);
		color: var(--primary);
	}

	.composer-emoji-toggle svg {
		width: 1.15rem;
		height: 1.15rem;
	}

	/* 表情面板：和评论区同一个数据源、同样的 8 列网格，
	   但类名自成一套（.composer-emoji-*），不吃 comment.css 里挂在 .tg-chat 上的规则 */
	.composer-emoji {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.45rem;
		border: 1px solid var(--line-color);
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--card-bg) 92%, var(--btn-regular-bg));
	}

	.composer-emoji-tabs {
		display: flex;
		gap: 0.3rem;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.composer-emoji-tabs::-webkit-scrollbar {
		display: none;
	}

	.composer-emoji-tab {
		flex: none;
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		font-size: 0.75rem;
		color: var(--content-meta);
	}

	.composer-emoji-tab.is-active {
		background: color-mix(in srgb, var(--primary) 14%, transparent);
		color: var(--primary);
	}

	.composer-emoji-grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 0.15rem;
		max-height: 8.5rem;
		overflow-y: auto;
		scrollbar-width: none;
	}

	.composer-emoji-grid::-webkit-scrollbar {
		display: none;
	}

	.composer-emoji-item {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		border-radius: 0.3rem;
		transition: background-color 0.12s ease-out;
	}

	.composer-emoji-item:hover {
		background: var(--btn-regular-bg);
	}

	.composer-emoji-item img {
		width: 1.55rem;
		height: 1.55rem;
		object-fit: contain;
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
