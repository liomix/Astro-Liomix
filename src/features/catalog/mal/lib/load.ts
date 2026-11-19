/**
 * MalPage 页面数据（构建期）。
 * 页面只负责布局与开关判断；取数、过滤、失败标记都在这里。
 */
import { siteConfig } from "@/shared/config/siteConfig";
import I18nKey from "@/shared/i18n/i18nKey";
import { i18n } from "@/shared/i18n/translation";
import "@/shared/styles/common.css";
import "@/features/catalog/styles/media-grid.css";
import { filterNsfw, isMalNsfw } from "@/features/catalog/lib/nsfw";
import {
	fetchMalList,
	type MalCategory,
	type MalListKind,
} from "@/features/catalog/mal/lib/mal";
import type { MalListItem } from "@/features/catalog/mal/types";
import { formatDateI18n } from "@/shared/lib/format/date";

export async function loadMalPageData() {
	// 检查页面是否启用

	// 获取构建时间
	const buildTime = formatDateI18n(new Date());

	////////////// MyAnimeList 配置 ////////////////////////
	const malConfig = {
		username: siteConfig.mal?.username || "",
		clientId: siteConfig.mal?.clientId || "",
		apiUrl: siteConfig.mal?.apiUrl || "https://api.myanimelist.net/v2",
		animeBaseUrl:
			siteConfig.mal?.animeBaseUrl || "https://myanimelist.net/anime/",
		mangaBaseUrl:
			siteConfig.mal?.mangaBaseUrl || "https://myanimelist.net/manga/",
		// 数据获取设置
		pagination: {
			limit: 100, // 每页获取数量
			delay: 100, // 请求间隔毫秒数，避免频率限制
			maxTotal: 1000, // 最大获取总数，防止无限循环（0=无限制）
		},
		// NSFW 处理："off" | "blur" | "hide"
		nsfw: siteConfig.mal?.nsfw ?? "off",
	};
	//////////////////////////////////////////////////

	// 检查是否已配置用户名和 Client ID
	const isConfigured =
		malConfig.username.trim() !== "" && malConfig.clientId.trim() !== "";

	// 开发模式下只获取一页数据，加快调试速度
	const isDev = import.meta.env.DEV;
	const maxPages = isDev ? 1 : 0; // 0 表示不限制

	/** 获取指定类型的全部列表数据 */
	async function fetchAll(kind: MalListKind): Promise<MalListItem[]> {
		const { limit, delay, maxTotal } = malConfig.pagination;
		let offset = 0;
		const allItems: MalListItem[] = [];

		while (true) {
			// 开发模式限制：只获取一页
			if (isDev && maxPages > 0 && allItems.length >= limit * maxPages) {
				console.log(`[MAL] Dev mode: fetched ${maxPages} page(s), stopping`);
				break;
			}

			// 检查是否超过最大获取限制
			if (maxTotal > 0 && allItems.length >= maxTotal) {
				console.log(`[MAL] Reached max fetch limit ${maxTotal}, stopping`);
				break;
			}

			const data = await fetchMalList({
				apiUrl: malConfig.apiUrl,
				username: malConfig.username,
				clientId: malConfig.clientId,
				kind,
				limit,
				offset,
			});
			const batch = data.data || [];
			allItems.push(...batch);

			// 没有下一页或本次获取为空时终止
			if (!data.paging?.next || batch.length === 0) break;
			offset += limit;

			// 添加延迟避免请求过于频繁
			await new Promise((resolve) => setTimeout(resolve, delay));
		}

		return allItems;
	}

	let animeItems: MalListItem[] = [];
	let mangaItems: MalListItem[] = [];
	let animeFailed = false;
	let mangaFailed = false;

	if (isConfigured) {
		console.log(
			`[MAL] ${isDev ? "🔧 Dev mode" : "🌐 Prod mode"} - fetching list for user ${malConfig.username}...`,
		);
		try {
			animeItems = await fetchAll("anime");
			console.log(`[MAL] Anime list: ${animeItems.length} items`);
		} catch (error) {
			console.error("[MAL] Failed to fetch anime list:", error);
			animeFailed = true;
		}
		try {
			mangaItems = await fetchAll("manga");
			console.log(`[MAL] Manga list: ${mangaItems.length} items`);
		} catch (error) {
			console.error("[MAL] Failed to fetch manga list:", error);
			mangaFailed = true;
		}
	}

	// 两个列表都获取失败才视为整体失败
	const fetchFailed = animeFailed && mangaFailed;

	// NSFW 拦截：hide 模式下过滤掉 NSFW 条目，保持分类计数一致
	animeItems = filterNsfw(animeItems, malConfig.nsfw, isMalNsfw);
	mangaItems = filterNsfw(mangaItems, malConfig.nsfw, isMalNsfw);

	// 构建分类（空列表的分类不显示）
	const categories: MalCategory[] = [];
	if (animeItems.length > 0) {
		categories.push({
			id: "anime",
			name: i18n(I18nKey.malCategoryAnime),
			count: animeItems.length,
			items: animeItems,
		});
	}
	if (mangaItems.length > 0) {
		categories.push({
			id: "manga",
			name: i18n(I18nKey.malCategoryManga),
			count: mangaItems.length,
			items: mangaItems,
		});
	}

	const activeCategory = categories[0]?.id || "anime";

	return {
		buildTime,
		malConfig,
		isConfigured,
		fetchFailed,
		categories,
		activeCategory,
	};
}
