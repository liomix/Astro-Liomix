<script lang="ts">
/**
 * 侧边栏动态组件 - 从 API 获取数据
 * 支持自定义 API 地址，方便接入第三方后端
 * 「更多动态」以弹窗形式展示全部条目，不再跳转动态页
 */

import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { onMount, tick } from "svelte";
import {
	registerDynamicActions,
	syncDynamicLikeStates,
} from "@/components/pages/dynamic/dynamic-actions";
import SidebarPop from "@/components/widget/SidebarPop.svelte";
import { formatDynamicDate } from "@/utils/date-utils";
import { dynamicAnchor } from "@/utils/dynamic-utils";
import { fetchWithDedup } from "@/utils/fetch-dedup";
import { hasVideoExtension } from "@/utils/image-animation";
import { fetchMemos } from "@/utils/memos-adapter";
import { formatCompactNumber } from "@/utils/number-utils";
import { url } from "@/utils/url-utils";

interface DynamicEntry {
	id: string;
	published: number;
	html: string;
	images?: Array<{ alt: string; src: string; title?: string }>;
	searchText?: string;
	pinned?: boolean;
	location?: string;
	/** 点赞基数 / 评论数：动态页头统计用的同一份数字，缺省 0 */
	likes?: number;
	comments?: number;
}

interface MemosConfig {
	enable: boolean;
	apiUrl: string;
	parent?: string;
}

interface Props {
	apiUrl: string;
	limit: number;
	memos?: MemosConfig;
	/** 站长信息，用于弹窗条目的头像与昵称 */
	profileName: string;
	profileUrl: string;
	avatarUrl?: string;
	/** 视频头像的封面图 URL */
	avatarPosterUrl?: string;
}

let {
	apiUrl,
	limit,
	memos,
	profileName,
	profileUrl,
	avatarUrl,
	avatarPosterUrl,
}: Props = $props();

// 弹窗里头像可能是视频（mp4/webm…），需要渲染成静音循环的 <video>
const avatarIsVideo = Boolean(avatarUrl) && hasVideoExtension(avatarUrl ?? "");

let allEntries: DynamicEntry[] = $state([]);
let totalCount = $state(0);
let loading = $state(true);
let error = $state(false);

let dialogOpen = $state(false);

const likeLabel = i18n(I18nKey.dynamicLike);
const commentLabel = i18n(I18nKey.dynamicComment);

// 侧栏只渲染前 limit 条，弹窗用全量
const entries = $derived(allEntries.slice(0, limit));

onMount(async () => {
	registerDynamicActions();
	try {
		let data: DynamicEntry[];
		if (memos?.enable) {
			data = await fetchMemos(memos.apiUrl, { parent: memos.parent });
		} else {
			data = await fetchWithDedup(apiUrl);
		}

		allEntries = data;
		totalCount = data.length;
		// 弹窗条目渲染完成后同步已点赞状态
		await tick();
		syncDynamicLikeStates();
	} catch {
		error = true;
	} finally {
		loading = false;
	}
});

// 从 HTML 中提取纯文本摘要
function getPlainText(html: string): string {
	const div = document.createElement("div");
	div.innerHTML = html;
	return div.textContent?.trim() || "";
}

// 格式化日期：统一「YYYY-MM-DD HH:mm」
// 第三方 API 和 Memos 使用浏览器本地时区，本地数据用站点时区
function formatDate(timestamp: number): string {
	const date = new Date(timestamp);
	if (apiUrl.startsWith("http") || memos?.enable) {
		return formatDynamicDate(
			date,
			Intl.DateTimeFormat().resolvedOptions().timeZone,
		);
	}
	return formatDynamicDate(date);
}

// 锚点 ID 要和动态页里那条的 id 完全一致（那边用同一个工具函数生成）
function permalinkOf(id: string): string {
	return url(`/dynamic/#${dynamicAnchor(id)}`);
}

/**
 * 评论按钮的地址：同样是那条动态，但多一个 ?comment=<id>。
 * 动态页读到它会滚动到该条并自动拉开评论抽屉，等于「点评论 = 直接看评论」。
 */
function commentLinkOf(id: string): string {
	return url(
		`/dynamic/?comment=${encodeURIComponent(id)}#${dynamicAnchor(id)}`,
	);
}

function openModal() {
	dialogOpen = true;
}

function closeModal() {
	dialogOpen = false;
}

function visibleImages(entry: DynamicEntry) {
	return (entry.images ?? []).slice(0, 4);
}
</script>

<div class="flex flex-col gap-1.5">
	{#if loading}
		<div class="flex justify-center p-3">
			<svg class="size-5 animate-spin text-(--primary)" viewBox="0 0 24 24" fill="none">
				<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25"/>
				<path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
			</svg>
		</div>
	{:else if error || entries.length === 0}
		<p class="m-0 p-3 text-center text-sm text-neutral-500">
			{i18n(I18nKey.dynamicEmpty)}
		</p>
	{:else}
		{#each entries as entry (entry.id)}
			{@const text = getPlainText(entry.html)}
			{@const hasImage = (entry.images?.length ?? 0) > 0}
			<a
				href={permalinkOf(entry.id)}
				class="group flex min-w-0 min-h-16 items-center gap-3 rounded-lg p-2
					text-neutral-700/75 dark:text-neutral-300/75
					hover:bg-(--btn-plain-bg-hover) hover:text-(--primary)
					active:bg-(--btn-plain-bg-active) transition-colors duration-150"
				aria-label={`${i18n(I18nKey.dynamic)}: ${text}`}
			>
				<div class="min-w-0 flex-1">
					<div class="mb-1 flex items-center gap-1 text-xs leading-4 text-(--primary)">
						<svg class="size-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
						</svg>
						<time datetime={new Date(entry.published).toISOString()}>
							{formatDate(entry.published)}
						</time>
						{#if hasImage || entry.pinned}
							<span class="ml-auto inline-flex items-center gap-1.5">
								{#if hasImage}
									<svg class="size-3.5 shrink-0 text-neutral-500 dark:text-neutral-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
										<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3L14.5 12l4.5 6H5z"/>
									</svg>
								{/if}
								{#if entry.pinned}
									<span class="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-(--primary)/10 text-(--primary) font-medium">
										<svg class="size-3" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2z"/></svg>
										{i18n(I18nKey.pinned)}
									</span>
								{/if}
							</span>
						{/if}
					</div>
					<p class="m-0 line-clamp-3 text-sm leading-[1.35rem]">
						{text}
					</p>
				</div>
			</a>
		{/each}

		<button
			type="button"
			class="btn-plain mt-2 flex w-full items-center justify-center gap-1 rounded-lg p-1.5
				text-sm text-(--primary)"
			onclick={openModal}
		>
			<svg class="size-4.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path d="M4 6h16V4H4zm0 14h16v-2H4zm0-6h10v-2H4z"/>
			</svg>
			<span>{i18n(I18nKey.moreDynamics)}</span>
			{#if totalCount > 0}
				<span class="opacity-60">({totalCount})</span>
			{/if}
		</button>
	{/if}
</div>

<SidebarPop bind:open={dialogOpen} title={i18n(I18nKey.latestDynamics)} count={totalCount} size="lg">
	{#each allEntries as entry (entry.id)}
		{@const text = getPlainText(entry.html)}
		{@const imgs = visibleImages(entry)}
		<article class="pop-item" data-like-id={entry.id}>
			<!-- 铺满整卡的点击层：空白处点击也能跳到该条动态 -->
			<a
				class="pop-cover"
				href={permalinkOf(entry.id)}
				tabindex="-1"
				aria-hidden="true"
				onclick={closeModal}
			></a>
			<header class="pop-head">
				<a class="pop-avatar" href={profileUrl} aria-label={profileName}>
					{#if avatarUrl}
						{#if avatarIsVideo}
							<video
								src={avatarUrl}
								poster={avatarPosterUrl || undefined}
								autoplay
								muted
								loop
								playsinline
								preload="auto"
								disablepictureinpicture
								aria-label={profileName}
								data-avatar-motion
							></video>
						{:else}
							<img src={avatarUrl} alt={profileName} loading="lazy" decoding="async" />
						{/if}
					{/if}
				</a>
				<a class="pop-author" href={profileUrl}>{profileName}</a>
				{#if entry.pinned}
					<span class="item-pinned">
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2z" />
						</svg>
						{i18n(I18nKey.pinned)}
					</span>
				{/if}
			</header>

			<a
				class="pop-link"
				href={permalinkOf(entry.id)}
				onclick={closeModal}
			>
				<p class="item-text">{text}</p>
				{#if imgs.length > 0}
					<div class="item-images" class:single={imgs.length === 1}>
						{#each imgs as img, index (img.src)}
							<span class="item-image">
								<img src={img.src} alt={img.alt} loading="lazy" decoding="async" />
								{#if index === imgs.length - 1 && (entry.images?.length ?? 0) > imgs.length}
									<span class="item-image-more">
										+{(entry.images?.length ?? 0) - imgs.length}
									</span>
								{/if}
							</span>
						{/each}
					</div>
				{/if}
			</a>

			<footer class="pop-foot">
				<time class="pop-time" datetime={new Date(entry.published).toISOString()}>
					{formatDate(entry.published)}
				</time>
				<div class="pop-actions">
					<button
						type="button"
						class="pop-action"
						data-dynamic-like
						data-like-base={entry.likes ?? 0}
						aria-pressed="false"
						aria-label={likeLabel}
						title={likeLabel}
					>
						<dynamic-lottie-icon data-animation="like-heart" style="font-size:1.35rem"></dynamic-lottie-icon>
						<span class="pop-action-count" data-dynamic-like-count>0</span>
					</button>
					<a
						class="pop-action"
						href={commentLinkOf(entry.id)}
						aria-label={commentLabel}
						title={commentLabel}
						onclick={closeModal}
					>
						<dynamic-lottie-icon
							data-animation="comment-chats"
							style="font-size:1.25rem"></dynamic-lottie-icon>
						<span class="pop-action-count" data-dynamic-comment-count
							>{formatCompactNumber(entry.comments ?? 0)}</span
						>
					</a>
				</div>
			</footer>
		</article>
	{/each}
</SidebarPop>

<style>
	.pop-item {
		position: relative;
		display: block;
		padding: 0.75rem;
		border-radius: 0.75rem;
		color: inherit;
		text-decoration: none;
		transition: background-color 0.15s ease;
	}

	/* 整卡点击层：置于内容之下，靠 header/footer 的 pointer-events 让空白处透传过来 */
	.pop-cover {
		position: absolute;
		z-index: 0;
		inset: 0;
		display: block;
		border-radius: inherit;
	}

	.pop-head,
	.pop-foot {
		position: relative;
		z-index: 1;
		pointer-events: none;
	}

	.pop-head > a,
	.pop-foot .pop-action {
		pointer-events: auto;
	}

	.pop-item + .pop-item {
		border-top: 1px solid var(--line-divider);
	}

	.pop-item:hover {
		background: var(--btn-plain-bg-hover);
	}

	.pop-head {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.pop-avatar {
		display: block;
		width: 2.75rem;
		height: 2.75rem;
		flex: 0 0 2.75rem;
		overflow: hidden;
		border-radius: 50%;
		background: var(--btn-regular-bg);
	}

	.pop-avatar img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.pop-avatar video {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.pop-author {
		min-width: 0;
		margin-top: 0.2rem;
		overflow: hidden;
		color: inherit;
		font-size: 0.95rem;
		font-weight: 600;
		line-height: 1.4;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pop-author:hover {
		color: var(--primary);
	}

	.pop-link {
		display: block;
		color: inherit;
		text-decoration: none;
	}

	.item-pinned {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 0.125rem;
		margin-top: 0.25rem;
		padding: 0 0.25rem;
		border-radius: 0.25rem;
		background: color-mix(in srgb, var(--primary) 12%, transparent);
		color: var(--primary);
		font-size: 0.625rem;
		line-height: 1.125rem;
		font-weight: 500;
	}

	.item-pinned svg {
		width: 0.625rem;
		height: 0.625rem;
		fill: currentColor;
	}

	.item-text {
		margin: 0;
		font-size: 0.9375rem;
		line-height: 1.7;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.item-images {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.25rem;
		margin-top: 0.5rem;
	}

	.item-images.single {
		grid-template-columns: minmax(0, 1fr);
	}

	.item-image {
		position: relative;
		display: block;
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: 0.375rem;
		background: var(--btn-regular-bg);
	}

	.item-images.single .item-image {
		aspect-ratio: auto;
	}

	.item-images.single .item-image img {
		height: auto;
		max-height: 22rem;
		object-fit: contain;
	}

	.item-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.item-image-more {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgb(0 0 0 / 0.45);
		color: #fff;
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.pop-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.pop-time {
		min-width: 0;
		color: var(--content-meta);
		font-size: 0.75rem;
		line-height: 1.4;
		font-variant-numeric: tabular-nums;
	}

	.pop-actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.125rem;
	}

	.pop-action {
		display: inline-flex;
		min-width: 2rem;
		height: 2rem;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding-inline: 0.45rem;
		border: 0;
		border-radius: 9999px;
		background: transparent;
		color: var(--content-meta);
		cursor: pointer;
		transition: color 0.16s ease, background-color 0.16s ease;
	}

	.pop-action-count {
		font-size: 0.72rem;
		font-weight: 600;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.pop-action:hover {
		background: var(--btn-regular-bg);
		color: var(--primary);
	}

	.pop-action.is-active {
		background: var(--btn-regular-bg);
		color: var(--primary);
	}
</style>
