<script lang="ts">
import { onMount, tick } from "svelte";
import {
	registerDynamicActions,
	syncDynamicLikeStates,
} from "@/features/dynamic/lib/dynamic-actions";
import { registerDynamicGallery } from "@/features/dynamic/lib/dynamic-gallery";
import { dynamicAnchor } from "@/features/dynamic/lib/dynamic-utils";
import CardSkeleton from "@/shared/components/ui/CardSkeleton.svelte";
import ClientPagination from "@/shared/components/ui/ClientPagination.svelte";
import { registerEmptyLottie } from "@/shared/components/ui/empty-lottie";
import I18nKey from "@/shared/i18n/i18nKey";
import { i18n } from "@/shared/i18n/translation";
import {
	fetchCommentCounts,
	slugOfPath,
} from "@/shared/lib/comments/comment-client";
import {
	closeCommentDrawer,
	openCommentDrawer,
} from "@/shared/lib/comments/comment-drawer";
import { commentApiConfig } from "@/shared/lib/comments/config";
import { formatDynamicDate } from "@/shared/lib/format/date";
import { formatCompactNumber } from "@/shared/lib/format/number";
// 点赞状态与事件类型都在通用模块里（文章页、动态页共用一份记录）
import { likeCountOf } from "@/shared/lib/likes/likes";

type DynamicImage = {
	alt: string;
	src: string;
	title?: string;
};

type DynamicData = {
	id: string;
	published: number;
	html: string;
	images: DynamicImage[];
	searchText: string;
	pinned?: boolean;
	location?: string;
	/** 点赞基数，数据源可选（缺省 0）；访客自己点的赞另算 */
	likes?: number;
	/** 评论数，数据源可选（缺省 0）；本站没接评论服务时就是 0 */
	comments?: number;
};

interface Props {
	source: string;
	itemsPerPage: number;
	showComments: boolean;
	/** 拉取失败时的提示。必须与「空」分开：请求挂了说「暂无动态」等于骗人 */
	/** 抽屉没有内容时的提示 */
}

const { source, itemsPerPage, showComments }: Props = $props();

// 文案归组件自己：父级只传数据，不该替组件装配 i18n（见 docs/改进清单.md P1-2）
const failedText = i18n(I18nKey.dynamicLoadFailed);
const emptyText = i18n(I18nKey.dynamicEmpty);
const noResultsText = i18n(I18nKey.dynamicNoResults);
const loadingText = i18n(I18nKey.dynamicLoading);
const allYearsText = i18n(I18nKey.dynamicAllYears);
const commentEmptyText = i18n(I18nKey.commentNotConfigured);

let entries = $state<DynamicData[]>([]);
let filtered = $state<DynamicData[]>([]);
/** 后端回报的真实评论数：id → 条数。缺的条目沿用数据源里的基数 */
let commentCounts = $state<Record<string, number>>({});
let currentPage = $state(1);
let loading = $state(true);
let failed = $state(false);
let templateReady = $state(false);
let list: HTMLElement;
let template: HTMLTemplateElement | null = null;
let searchInput: HTMLInputElement | null = null;
let yearSelect: HTMLSelectElement | null = null;
let restoreAnchorAfterRender = false;
/** 待自动展开评论的那条动态（渲染完成后再开，见 renderItems） */
let pendingCommentId: string | null = null;

const pageEntries = $derived(
	filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
);

/** 页头统计条的三格 */
type StatName = "posts" | "likes" | "comments";

/** 每格上一轮的动画句柄：连着点赞时先把上一轮掐掉，否则两层数字会叠着跑 */
const statFrames = new WeakMap<HTMLElement, number>();

function paintStat(name: StatName, value: number): void {
	const el = document.querySelector<HTMLElement>(
		`[data-dynamic-stat="${name}"]`,
	);
	if (!el) return;
	const running = statFrames.get(el);
	if (running !== undefined) cancelAnimationFrame(running);
	statFrames.delete(el);

	const target = Math.max(0, Math.round(value));
	// 第一次写入时元素上还没有 data-value：从 0 数上去
	const from = el.dataset.value === undefined ? 0 : Number(el.dataset.value);
	el.dataset.value = String(target);

	if (
		window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
		!Number.isFinite(from) ||
		from === target
	) {
		el.textContent = formatCompactNumber(target);
		return;
	}

	const duration = 560;
	const started = performance.now();
	const step = (now: number) => {
		const progress = Math.min(1, (now - started) / duration);
		// easeOutCubic：起步快、收尾安静，数字停下时不突兀
		const eased = 1 - (1 - progress) ** 3;
		el.textContent = formatCompactNumber(
			Math.round(from + (target - from) * eased),
		);
		if (progress < 1) statFrames.set(el, requestAnimationFrame(step));
		else statFrames.delete(el);
	};
	statFrames.set(el, requestAnimationFrame(step));
}

/**
 * 一条动态在评论后端里的 slug。
 *
 * 必须和抽屉里算出来的那个完全一致（`slugOfPath` 把 `/dynamic/<id>/` 压成
 * `dynamic-<id>`），否则卡片问的和抽屉拉的是两篇，数字永远对不上。
 */
function commentSlugOf(id: string): string {
	return slugOfPath(`/dynamic/${id}/`);
}

/** 卡片上该显示的评论数：后端答过的优先，其次才是数据源里的基数 */
function commentCountOf(entry: DynamicData): number {
	return commentCounts[entry.id] ?? (Number(entry.comments) || 0);
}

/**
 * 刷新页头那三格：动态条数 / 获赞 / 评论（都是全站合计，不跟着筛选走）。
 * 点赞数以后端快照为准（`likeCountOf`，读不到才退回数据源里的基数），
 * 评论数同理（pending 不算，所以刚发的评论不会让数字立刻跳一下）。
 */
function syncHeroStats(): void {
	let likes = 0;
	let comments = 0;
	for (const entry of entries) {
		likes += likeCountOf(entry.id) ?? (Number(entry.likes) || 0);
		comments += commentCountOf(entry);
	}
	paintStat("posts", entries.length);
	paintStat("likes", likes);
	paintStat("comments", comments);
}

function pageFromUrl() {
	return Math.max(
		1,
		Number(new URL(window.location.href).searchParams.get("page")) || 1,
	);
}

function updateUrl(clearHash = false) {
	const current = new URL(window.location.href);
	if (currentPage > 1) current.searchParams.set("page", String(currentPage));
	else current.searchParams.delete("page");
	if (clearHash) current.hash = "";
	history.replaceState(history.state, "", current);
}

function applyFilters(resetPage = true) {
	const query = searchInput?.value.toLocaleLowerCase().trim() || "";
	const year = yearSelect?.value || "all";
	filtered = entries.filter(
		(entry) =>
			(year === "all" ||
				String(new Date(entry.published).getUTCFullYear()) === year) &&
			(!query || entry.searchText.includes(query)),
	);
	if (resetPage) currentPage = 1;
	const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
	currentPage = Math.min(currentPage, totalPages);
	updateUrl(resetPage);
}

function populateYears() {
	if (!yearSelect) return;
	yearSelect.replaceChildren();
	const all = document.createElement("option");
	all.value = "all";
	all.textContent = allYearsText;
	yearSelect.append(all);
	const years = [
		...new Set(
			entries.map((entry) => new Date(entry.published).getUTCFullYear()),
		),
	];
	for (const year of years) {
		const option = document.createElement("option");
		option.value = String(year);
		option.textContent = String(year);
		yearSelect.append(option);
	}
}

function createItem(entry: DynamicData) {
	if (!template) return null;
	const fragment = template.content.cloneNode(true) as DocumentFragment;
	const root = fragment.querySelector<HTMLElement>("[data-dynamic-entry]");
	if (!root) return null;
	const anchorId = dynamicAnchor(entry.id);
	const permalinkUrl = new URL(window.location.href);
	permalinkUrl.hash = anchorId;
	const permalink = `${permalinkUrl.pathname}${permalinkUrl.search}${permalinkUrl.hash}`;
	root.id = anchorId;
	root.dataset.likeId = entry.id;
	root.dataset.year = String(new Date(entry.published).getUTCFullYear());

	const author = root.querySelector<HTMLElement>("[data-dynamic-author]");
	if (author) {
		author.id = `${anchorId}-author`;
		root.querySelector("article")?.setAttribute("aria-labelledby", author.id);
	}
	root
		.querySelectorAll<HTMLAnchorElement>("[data-dynamic-permalink]")
		.forEach((link) => {
			link.href = permalink;
			link.dataset.noSwup = "";
			link.addEventListener("click", (event) => {
				if (
					event.button !== 0 ||
					event.metaKey ||
					event.ctrlKey ||
					event.shiftKey ||
					event.altKey
				)
					return;
				event.preventDefault();
				event.stopPropagation();
				history.replaceState(history.state, "", permalink);
			});
		});
	const time = root.querySelector<HTMLTimeElement>("[data-dynamic-time]");
	if (time) {
		const date = new Date(entry.published);
		time.dateTime = date.toISOString();
		// 第三方 API 用浏览器本地时区，本地构建数据用站点时区
		time.textContent = source.startsWith("http")
			? formatDynamicDate(
					date,
					Intl.DateTimeFormat().resolvedOptions().timeZone,
				)
			: formatDynamicDate(date);
	}

	const content = root.querySelector<HTMLElement>("[data-dynamic-content]");
	if (content) {
		content.id = `${anchorId}-content`;
		content.innerHTML = entry.html;
		for (const image of entry.images) {
			const element = document.createElement("img");
			element.src = image.src;
			element.alt = image.alt;
			element.loading = "lazy";
			if (image.title) element.title = image.title;
			content.append(element);
		}
		const gallery = root.querySelector<HTMLElement>("dynamic-gallery");
		if (gallery) gallery.dataset.sourceId = content.id;
	}

	// 置顶标识
	const pinned = root.querySelector<HTMLElement>("[data-dynamic-pinned]");
	if (pinned) {
		if (entry.pinned) {
			pinned.removeAttribute("hidden");
		} else {
			pinned.setAttribute("hidden", "");
		}
	}

	// 点赞 / 评论基数：数据里带了就写进按钮，卡片上的数字和页头统计用的是同一份
	const likeButton = root.querySelector<HTMLElement>("[data-like]");
	if (likeButton) likeButton.dataset.likeBase = String(entry.likes ?? 0);
	const commentButton = root.querySelector<HTMLElement>("[data-comment-open]");
	if (commentButton) {
		commentButton.dataset.commentBase = String(commentCountOf(entry));
	}

	// 评论地址挂到条目上：底部评论按钮点开的是右侧抽屉，抽屉按这个地址装 iframe，
	// 地址里的 path 会被评论页算成这条动态的评论线程 slug。
	// embed=1 告诉评论页「你在抽屉里」：据此渲染那颗关闭按钮，仅此而已 ——
	// 壁纸与顶底栏毛玻璃都在评论页自己的文档里，不依赖父窗口
	if (showComments) {
		root.dataset.commentSrc = `/dynamic/comments/?embed=1&path=${encodeURIComponent(
			`/dynamic/${entry.id}/`,
		)}`;
	}
	root.dataset.commentEmpty = commentEmptyText;
	return fragment;
}

/**
 * 把后端回报的评论数写回已经渲染出来的卡片。
 *
 * createItem 只能拿到克隆那一刻的数字，而请求回来时卡片通常已经在 DOM 里了。
 * 不重排整批条目（那会重建所有节点、丢掉锚点与滚动位置），只改按钮上的基数，
 * 再交给 syncDynamicLikeStates 统一重涂文字。
 */
function paintCommentCounts(): void {
	if (!list) return;
	for (const root of Array.from(
		list.querySelectorAll<HTMLElement>("[data-dynamic-entry]"),
	)) {
		const id = root.dataset.likeId;
		if (!id) continue;
		const count = commentCounts[id];
		if (count === undefined) continue;
		const button = root.querySelector<HTMLElement>("[data-comment-open]");
		if (button) button.dataset.commentBase = String(count);
	}
	syncDynamicLikeStates(list);
}

/**
 * 问一遍后端：这些动态各有多少条已审核评论。
 *
 * 失败就留着数据源里的基数：卡片上写 0 至少是个数字，换成「—」会让整条统计
 * 看起来坏掉；而且这批数字只是装饰，不值得惊动用户。
 */
async function loadCommentCounts(): Promise<void> {
	if (!showComments || !commentApiConfig.enable || entries.length === 0) return;
	try {
		const counts = await fetchCommentCounts(
			entries.map((entry) => commentSlugOf(entry.id)),
		);
		const next: Record<string, number> = {};
		for (const entry of entries) {
			const count = counts.get(commentSlugOf(entry.id));
			if (count !== undefined) next[entry.id] = count;
		}
		commentCounts = next;
		paintCommentCounts();
		syncHeroStats();
	} catch (error) {
		console.warn("Failed to load comment counts", error);
	}
}

async function renderItems(items: DynamicData[]) {
	await tick();
	if (!list || !template) return;
	// 分页 / 筛选会换掉整批条目，抽屉还开着的话它对应的按钮已经不存在了
	closeCommentDrawer(false);
	list.replaceChildren();
	for (const entry of items) {
		const item = createItem(entry);
		if (item) list.append(item);
	}
	syncDynamicLikeStates(list);
	if (restoreAnchorAfterRender) {
		restoreAnchorAfterRender = false;
		const target = document.getElementById(
			decodeURIComponent(window.location.hash.slice(1)),
		);
		target?.scrollIntoView({ behavior: "auto", block: "start" });
	}
	// 定位完了再开抽屉，免得两条滚动逻辑打架
	if (pendingCommentId) {
		const target = pendingCommentId;
		pendingCommentId = null;
		openCommentsFor(target);
	}
}

function goToPage(page: number) {
	currentPage = page;
	updateUrl(true);
	document
		.querySelector(".page-shell")
		?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * 展开某条动态的评论抽屉（从侧栏弹窗点「评论」跳进来的那条）。
 * 返回 false 表示这条还没渲染出来，调用方应该先记下来、等 renderItems 收尾。
 */
function openCommentsFor(id: string): boolean {
	if (!list) return false;
	const nodes = Array.from(
		list.querySelectorAll<HTMLElement>("[data-dynamic-entry]"),
	);
	const root = nodes.find((node) => node.dataset.likeId === id);
	const button = root?.querySelector<HTMLElement>("[data-comment-open]");
	// 没接评论服务时条目上没有 comment-src，只有按钮 —— 这时保持安静，不弹空抽屉
	if (!root || !button || !root.dataset.commentSrc) return false;
	// 先把这条滚进视口，用户才知道评论是从哪条动态弹出来的
	root.scrollIntoView({ behavior: "auto", block: "start" });
	openCommentDrawer(
		root.dataset.commentSrc,
		button,
		root.dataset.commentEmpty ?? "",
	);
	return true;
}

/**
 * 消化地址栏里的 ?comment=<id>：侧栏动态弹窗的评论按钮就是跳到这个地址来的。
 * 命中后把参数从地址栏擦掉 —— 刷新、前进后退时不该再弹一次。
 */
function consumeCommentRequest(): void {
	if (!filtered.length) return;
	const current = new URL(window.location.href);
	const id = current.searchParams.get("comment");
	if (!id) return;
	const index = filtered.findIndex((entry) => entry.id === id);
	// 不在当前筛选结果里（比如搜索词/年份还挂着）就静默放弃
	if (index < 0) return;
	current.searchParams.delete("comment");
	history.replaceState(history.state, "", current);

	const page = Math.floor(index / itemsPerPage) + 1;
	if (page !== currentPage) {
		pendingCommentId = id;
		currentPage = page;
		updateUrl();
		return;
	}
	// 条目可能还没渲染（刚加载完 / 刚换页）：记下来，交给这一次的 renderItems 收尾。
	// 不要在这里自己再调一次 renderItems —— 那会和 $effect 各渲染一遍，
	// 后一遍的 replaceChildren 会把刚打开的抽屉连同按钮一起换掉。
	if (!openCommentsFor(id)) pendingCommentId = id;
}

$effect(() => {
	if (!templateReady) return;
	renderItems(pageEntries);
});

onMount(() => {
	registerEmptyLottie();
	registerDynamicGallery();
	registerDynamicActions();
	const page = list.closest(".page-shell");
	template =
		page?.querySelector<HTMLTemplateElement>("[data-dynamic-item-template]") ??
		null;
	templateReady = template !== null;
	searchInput =
		page?.querySelector<HTMLInputElement>("[data-dynamic-search]") ?? null;
	yearSelect =
		page?.querySelector<HTMLSelectElement>("[data-year-select]") ?? null;
	const filter = () => applyFilters();
	searchInput?.addEventListener("input", filter);
	yearSelect?.addEventListener("change", filter);

	const load = async () => {
		try {
			const response = await fetch(source);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			entries = (await response.json()) as DynamicData[];
			// 更新页头统计（动态条数 / 获赞 / 评论）
			syncHeroStats();
			// 真实评论数随后端回来再刷一次；拿不到就沿用数据源里的基数
			void loadCommentCounts();
			populateYears();
			currentPage = pageFromUrl();
			applyFilters(false);
			const anchorId = decodeURIComponent(window.location.hash.slice(1));
			if (anchorId) {
				const anchorIndex = filtered.findIndex(
					(entry) => dynamicAnchor(entry.id) === anchorId,
				);
				if (anchorIndex >= 0) {
					currentPage = Math.floor(anchorIndex / itemsPerPage) + 1;
					updateUrl();
					restoreAnchorAfterRender = true;
				}
			}
		} catch (error) {
			console.error("Failed to load dynamics", error);
			failed = true;
		} finally {
			loading = false;
		}
		// 数据就位后再认 ?comment=<id>：从侧栏弹窗点评论跳进来时自动展开那条的评论
		consumeCommentRequest();
	};
	void load();

	// 已经停在动态页时再从弹窗点评论，Swup 不会重挂这个组件，地址变化得自己盯着
	const onLocationChange = () => consumeCommentRequest();
	window.addEventListener("hashchange", onLocationChange);
	window.addEventListener("popstate", onLocationChange);
	document.addEventListener("swup:page:view", onLocationChange);

	// 点赞（卡片上或侧栏弹窗里）会派发这个事件，横幅的「获赞」跟着重算
	const onLikeChange = (event: Event) => {
		// like:change（自己点的）与 like:states（批量快照回来了）都只是「重算一下」
		// 的信号，detail 的形状不重要
		if (!(event as CustomEvent).detail) return;
		syncHeroStats();
	};
	document.addEventListener("like:change", onLikeChange);
	// 批量读完点赞快照也会派发一次：别人点过的赞同样要让「获赞」动起来
	document.addEventListener("like:states", onLikeChange);

	return () => {
		searchInput?.removeEventListener("input", filter);
		yearSelect?.removeEventListener("change", filter);
		window.removeEventListener("hashchange", onLocationChange);
		window.removeEventListener("popstate", onLocationChange);
		document.removeEventListener("swup:page:view", onLocationChange);
		document.removeEventListener("like:change", onLikeChange);
		document.removeEventListener("like:states", onLikeChange);
	};
});
</script>

{#if loading}
	<!-- 加载中：按卡片的形状占位（头像 / 昵称 / 正文 / 动作条），数据回来是替换不是重排 -->
	<CardSkeleton rows={2} label={loadingText} />
{:else if failed}
	<div class="page-empty card-base" role="alert">
		<p>{failedText}</p>
	</div>
{:else if entries.length === 0}
	<div class="page-empty card-base">
		<empty-lottie class="page-empty__art" data-animation="empty"
		></empty-lottie>
		<p>{emptyText}</p>
	</div>
{:else if filtered.length === 0}
	<div class="page-no-results card-base">
		<empty-lottie class="page-empty__art" data-animation="empty"
		></empty-lottie>
		<p>{noResultsText}</p>
	</div>
{/if}

<div class="page-feed" bind:this={list}></div>

{#if !loading && !failed}
	<ClientPagination
		totalItems={filtered.length}
		{itemsPerPage}
		{currentPage}
		onPageChange={goToPage}
	/>
{/if}
