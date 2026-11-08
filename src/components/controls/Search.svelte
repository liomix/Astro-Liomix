<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { navigateToPage } from "@utils/navigation-utils";
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type { SearchResult } from "@/global";
import { FLOATING_PANEL_CLOSE_EVENT } from "@/utils/floating-panel-utils";
import { url as formatUrl, getSearchUrl } from "@/utils/url-utils";

// --- State ---
let keyword = "";
let result: SearchResult[] = [];
let isSearching = false;
let initialized = false;
let debounceTimer: NodeJS.Timeout;
let searchRequestId = 0;
let inputEl: HTMLInputElement | undefined;

// --- Mocks for Dev Mode ---
const fakeResult: SearchResult[] = [
	{
		url: formatUrl("/"),
		meta: { title: "This Is a Fake Search Result" },
		excerpt:
			"Because Pagefind cannot work in the <mark>dev</mark> environment.",
	},
	{
		url: formatUrl("/"),
		meta: { title: "If You Want to Test the Search" },
		excerpt: "Try running <mark>npm build && npm preview</mark> instead.",
	},
];

// --- UI Logic ---
// pagefind.js 是按需加载的（见 Navbar.astro），搜索 UI 一被碰到就触发。
// 幂等，重复调用只会拿到同一个 promise。
const requestPagefind = (): void => {
	window.__loadPagefind?.();
};

const getPanel = (): HTMLElement | null =>
	document.getElementById("search-panel");

const isPanelOpen = (): boolean => {
	const panel = getPanel();
	return !!panel && !panel.classList.contains("float-panel-closed");
};

// 弹窗打开后把焦点交给输入框：桌面端不用再点一次，直接打字即可
const focusInput = (): void => {
	requestAnimationFrame(() => inputEl?.focus());
};

const openPanel = (): void => {
	requestPagefind();
	getPanel()?.classList.remove("float-panel-closed");
	focusInput();
};

const closePanel = (): void => {
	getPanel()?.classList.add("float-panel-closed");
};

const togglePanel = (): void => {
	if (isPanelOpen()) closePanel();
	else openPanel();
};

// 关闭按钮 / 结果跳转用：连输入内容和结果一起清掉，下次打开是干净的
const closeSearchPanel = (): void => {
	closePanel();
	keyword = "";
	result = [];
};

const cancelPendingSearch = (): void => {
	clearTimeout(debounceTimer);
	searchRequestId += 1;
	isSearching = false;
};

const handleResultClick = (event: Event, url: string): void => {
	event.preventDefault();
	closeSearchPanel();
	navigateToPage(url);
};

// --- Core Search Logic ---
const search = async (kw: string): Promise<void> => {
	if (!kw) {
		cancelPendingSearch();
		result = [];
		return;
	}
	if (!initialized) return;

	clearTimeout(debounceTimer);
	const requestId = ++searchRequestId;
	isSearching = true;

	debounceTimer = setTimeout(async () => {
		try {
			let searchResults: SearchResult[] = [];

			if (import.meta.env.PROD && window.pagefind) {
				const response = await window.pagefind.search(kw);
				searchResults = await Promise.all(
					response.results.map((item) => item.data()),
				);
			} else if (import.meta.env.DEV) {
				searchResults = fakeResult;
			}

			if (requestId !== searchRequestId) return;
			result = searchResults;
		} catch (error) {
			if (requestId !== searchRequestId) return;

			console.error("Search error:", error);
			result = [];
		} finally {
			if (requestId === searchRequestId) {
				isSearching = false;
			}
		}
	}, 300); // 300ms debounce
};

// --- Initialization onMount ---
onMount(() => {
	const initializePagefind = () => {
		initialized = true;
		if (keyword) search(keyword);
	};

	if (import.meta.env.DEV) {
		console.log("Pagefind mock enabled in development mode.");
		initializePagefind();
	} else {
		if (window.pagefind) {
			// If script already loaded
			initializePagefind();
		} else {
			// Listen for the event
			document.addEventListener("pagefindready", initializePagefind, {
				once: true,
			});
			document.addEventListener("pagefindloaderror", initializePagefind, {
				once: true,
			});
		}
	}

	const panel = getPanel();
	// 面板的三种关闭路径（点 ×、点遮罩、ESC）最终都会派发这个事件，
	// 统一在这里清空关键词和结果，保证下次打开是干净的
	const handlePanelClose = (): void => {
		cancelPendingSearch();
		keyword = "";
		result = [];
	};
	panel?.addEventListener(FLOATING_PANEL_CLOSE_EVENT, handlePanelClose);

	return () => {
		panel?.removeEventListener(FLOATING_PANEL_CLOSE_EVENT, handlePanelClose);
		document.removeEventListener("pagefindready", initializePagefind);
		document.removeEventListener("pagefindloaderror", initializePagefind);
		cancelPendingSearch();
	};
});

// --- Reactive Statements ---
$: if (initialized && keyword !== undefined) {
	search(keyword);
}
</script>

<!-- 搜索入口：与主题切换按钮同规格的纯图标按钮 -->
<button
	type="button"
	on:click={togglePanel}
	aria-label={i18n(I18nKey.search)}
	aria-controls="search-panel"
	aria-expanded="false"
	class="nav-icon-btn"
	id="search-switch"
>
	<Icon icon="material-symbols:search" class="text-[1.25rem]"></Icon>
</button>

<!-- 弹窗打开时的全屏遮罩（点它即关闭，走全局 click-outside） -->
<div class="search-backdrop" aria-hidden="true"></div>

<!-- 搜索弹窗 -->
<div
	id="search-panel"
	class="float-panel float-panel-closed search-panel search-dialog"
	data-floating-panel
	data-floating-panel-trigger="search-switch"
	inert
	aria-hidden="true"
>
	<div class="search-dialog-head">
		<span class="search-dialog-title">{i18n(I18nKey.search)}</span>
		<button
			type="button"
			class="search-dialog-close"
			aria-label="Close search"
			on:click={closeSearchPanel}
		>
			<Icon icon="material-symbols:close" class="text-[1.3rem]"></Icon>
		</button>
	</div>

	<div class="search-input-row">
		<input
			id="search-input"
			bind:this={inputEl}
			bind:value={keyword}
			type="search"
			autocomplete="off"
			class="search-input"
			aria-label={i18n(I18nKey.search)}
		/>
		<Icon icon="material-symbols:search" class="search-input-icon"></Icon>
	</div>

	<div class="search-dialog-results">
		{#if isSearching}
			<div class="search-hint">{i18n(I18nKey.searchLoading)}</div>
		{:else if result.length > 0}
			{#each result.slice(0, 5) as item}
				<a
					href={item.url}
					on:click={(e) => handleResultClick(e, item.url)}
					class="transition group block rounded-xl text-lg px-3 py-2 hover:bg-(--btn-plain-bg-hover) active:bg-(--btn-plain-bg-active)"
				>
					<div
						class="transition text-90 inline-flex font-bold group-hover:text-(--primary)"
					>
						{@html item.meta.title}
						<Icon
							icon="fa7-solid:chevron-right"
							class="transition text-[0.75rem] translate-x-1 my-auto text-(--primary)"
						></Icon>
					</div>
					{#if item.excerpt.includes("<mark>")}
						<div class="search-excerpt text-sm text-50">
							<div>
								{@html item.excerpt}
							</div>
						</div>
					{/if}

					{#if item.content && item.content.includes("<mark>")}
						<div class="search-excerpt text-sm text-30">
							<span class="search-content-tag">
								{i18n(I18nKey.searchContent)}
							</span>
							<div>
								{@html item.content}
							</div>
						</div>
					{/if}
				</a>
			{/each}
			{#if result.length > 5}
				<a
					href={getSearchUrl(keyword)}
					on:click={(e) => handleResultClick(e, getSearchUrl(keyword))}
					class="transition group block rounded-xl text-lg px-3 py-2 hover:bg-(--btn-plain-bg-hover) active:bg-(--btn-plain-bg-active) text-(--primary) font-bold text-center"
				>
					<span class="inline-flex items-center">
						{i18n(I18nKey.searchViewMore).replace(
							"{count}",
							(result.length - 5).toString(),
						)}
						<Icon
							icon="fa7-solid:arrow-right"
							class="transition text-[0.75rem] ml-1"
						></Icon>
					</span>
				</a>
			{/if}
		{:else if keyword}
			<div class="search-hint">{i18n(I18nKey.searchNoResults)}</div>
		{/if}
	</div>
</div>

<style>
	.search-excerpt {
		display: flex;
		align-items: flex-start;
		margin-top: 0.1rem;
	}

	.search-content-tag {
		display: inline-block;
		flex-shrink: 0;
		margin-right: 0.5em;
		padding: 0.1em 0.4em;
		border-radius: 5px;
		background-color: var(--btn-plain-bg-active);
		color: var(--primary);
		font-size: 0.75em;
		font-weight: 600;
	}
</style>
