<script lang="ts">
import { onMount, tick } from "svelte";
import ClientPagination from "@/components/common/ClientPagination.svelte";
import {
	type LikeChangeDetail,
	readLikedIds,
	registerDynamicActions,
	syncDynamicLikeStates,
} from "@/components/pages/dynamic/dynamic-actions";
import {
	closeCommentDrawer,
	openCommentDrawer,
} from "@/components/pages/dynamic/dynamic-comment-drawer";
import { formatDynamicDate } from "@/utils/date-utils";
import { dynamicAnchor } from "@/utils/dynamic-utils";
import { fetchMemos } from "@/utils/memos-adapter";
import { formatCompactNumber } from "@/utils/number-utils";
import { registerDynamicGallery } from "./dynamic-gallery";

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

interface MemosConfig {
	enable: boolean;
	apiUrl: string;
	parent?: string;
}

interface Props {
	source: string;
	itemsPerPage: number;
	showComments: boolean;
	emptyText: string;
	noResultsText: string;
	loadingText: string;
	allYearsText: string;
	/** 抽屉没有内容时的提示 */
	commentEmptyText: string;
	memos?: MemosConfig;
}

const {
	source,
	itemsPerPage,
	showComments,
	emptyText,
	noResultsText,
	loadingText,
	allYearsText,
	commentEmptyText,
	memos,
}: Props = $props();

let entries = $state<DynamicData[]>([]);
let filtered = $state<DynamicData[]>([]);
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
 * 刷新页头那三格：动态条数 / 获赞 / 评论（都是全站合计，不跟着筛选走）。
 * 数据源没给 likes、comments 时按 0 算；获赞再加上访客自己点过的那些赞。
 */
function syncHeroStats(): void {
	const liked = readLikedIds();
	let likes = 0;
	let comments = 0;
	for (const entry of entries) {
		likes += Number(entry.likes) || 0;
		comments += Number(entry.comments) || 0;
		if (liked.has(entry.id)) likes += 1;
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
		// 第三方 API 和 Memos 使用浏览器本地时区，本地构建数据用站点时区
		time.textContent =
			source.startsWith("http") || memos?.enable
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
	const likeButton = root.querySelector<HTMLElement>("[data-dynamic-like]");
	if (likeButton) likeButton.dataset.likeBase = String(entry.likes ?? 0);
	const commentButton = root.querySelector<HTMLElement>(
		"[data-dynamic-comment]",
	);
	if (commentButton) {
		commentButton.dataset.commentBase = String(entry.comments ?? 0);
	}

	// 评论地址挂到条目上：底部评论按钮点开的是右侧抽屉，抽屉按这个地址装 iframe
	// （iframe 里是 Telegram 风格的聊天界面，消息目前为内置示例）。
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
	const button = root?.querySelector<HTMLElement>("[data-dynamic-comment]");
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
			if (memos?.enable) {
				entries = await fetchMemos(memos.apiUrl, { parent: memos.parent });
			} else {
				const response = await fetch(source);
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				entries = (await response.json()) as DynamicData[];
			}
			// 更新页头统计（动态条数 / 获赞 / 评论）
			syncHeroStats();
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
		const detail = (event as CustomEvent<LikeChangeDetail>).detail;
		if (!detail) return;
		syncHeroStats();
	};
	document.addEventListener("dynamic:like-change", onLikeChange);

	return () => {
		searchInput?.removeEventListener("input", filter);
		yearSelect?.removeEventListener("change", filter);
		window.removeEventListener("hashchange", onLocationChange);
		window.removeEventListener("popstate", onLocationChange);
		document.removeEventListener("swup:page:view", onLocationChange);
		document.removeEventListener("dynamic:like-change", onLikeChange);
	};
});
</script>

{#if loading}
	<div class="page-loading card-base" role="status">
		<span class="page-loading-spinner" aria-hidden="true"></span>
		<p>{loadingText}</p>
	</div>
{:else if failed || entries.length === 0}
	<div class="page-empty card-base">
		<p>{emptyText}</p>
	</div>
{:else if filtered.length === 0}
	<div class="page-no-results card-base">
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
