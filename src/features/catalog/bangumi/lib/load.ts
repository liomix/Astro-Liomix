/**
 * Bangumi 页面数据（构建期）
 * ---------------------------------------------------------------------------
 * 静态模式在这里把全部收藏拉完并按 NSFW 策略过滤；动态模式只返回配置，
 * 由 Svelte 岛在浏览器里分页拉。抓取失败时抛错 / 置 fetchFailed，
 * 页面据此渲染「抓取失败」，不会假装「你没有收藏」。
 */

import { filterNsfw, isBangumiNsfw } from "@/features/catalog/lib/nsfw";
import { siteConfig } from "@/shared/config/siteConfig";
import I18nKey from "@/shared/i18n/i18nKey";
import { i18n } from "@/shared/i18n/translation";
import { formatDateI18n } from "@/shared/lib/format/date";
import type {
	UserSubjectCollection,
	UserSubjectCollectionResponse,
} from "../types";

export async function loadBangumiPageData() {
	const buildTime = formatDateI18n(new Date());

	////////////// Bangumi 配置 ////////////////////////
	const bangumiConfig = {
		username: siteConfig.bangumi?.userId, // 在这里配置你的Bangumi用户名
		mode: (siteConfig.bangumi?.mode || "static") as "static" | "dynamic",
		apiUrl: siteConfig.bangumi?.apiUrl || "https://api.bangumi.one",
		subjectBaseUrl:
			siteConfig.bangumi?.subjectBaseUrl || "https://bangumi.one/subject/",
		// 从配置文件中读取各分类是否启用，若未配置则使用默认值
		categories: {
			book: siteConfig.bangumi?.categories?.book ?? true,
			anime: siteConfig.bangumi?.categories?.anime ?? true,
			music: siteConfig.bangumi?.categories?.music ?? true,
			game: siteConfig.bangumi?.categories?.game ?? true,
			real: siteConfig.bangumi?.categories?.real ?? false,
		},
		// 数据获取设置
		pagination: {
			limit: 50, // 每页获取数量
			delay: 50, // 请求间隔毫秒数，避免频率限制
			maxTotal: 1000, // 最大获取总数，防止无限循环（0=无限制）
		},
		// NSFW 处理："off" | "blur" | "hide"
		nsfw: siteConfig.bangumi?.nsfw ?? "off",
	};
	//////////////////////////////////////////////////

	const isDynamic = bangumiConfig.mode === "dynamic";

	// 分类映射
	const categoryMap = {
		book: {
			id: "book",
			name: i18n(I18nKey.bangumiCategoryBook),
			subjectType: 1,
		},
		anime: {
			id: "anime",
			name: i18n(I18nKey.bangumiCategoryAnime),
			subjectType: 2,
		},
		music: {
			id: "music",
			name: i18n(I18nKey.bangumiCategoryMusic),
			subjectType: 3,
		},
		game: {
			id: "game",
			name: i18n(I18nKey.bangumiCategoryGame),
			subjectType: 4,
		},
		real: {
			id: "real",
			name: i18n(I18nKey.bangumiCategoryReal),
			subjectType: 6,
		},
	};

	// 获取Bangumi数据的函数 - 支持分页获取所有数据
	async function fetchBangumiData(username: string, subjectType: number) {
		const { limit, delay, maxTotal } = bangumiConfig.pagination;
		let offset = 0;
		let allData: UserSubjectCollection[] = [];
		let hasMore = true;

		// 开发模式下只获取一页数据，加快调试速度
		const isDev = import.meta.env.DEV;
		const maxPages = isDev ? 1 : 0; // 0 表示不限制

		console.log(
			`[Bangumi] ${isDev ? "🔧 Dev mode" : "🌐 Prod mode"} - fetching subjectType ${subjectType} data for user ${username}...`,
		);

		while (hasMore) {
			// 开发模式限制：只获取一页
			if (isDev && maxPages > 0 && allData.length >= limit * maxPages) {
				console.log(
					`[Bangumi] Dev mode: fetched ${maxPages} page(s), stopping`,
				);
				break;
			}

			// 检查是否超过最大获取限制
			if (maxTotal > 0 && allData.length >= maxTotal) {
				console.log(`[Bangumi] Reached max fetch limit ${maxTotal}, stopping`);
				break;
			}

			const url = `${bangumiConfig.apiUrl}/v0/users/${username}/collections?subject_type=${subjectType}&limit=${limit}&offset=${offset}`;

			console.log(
				`[Bangumi] Fetching data: ${url} (fetched: ${allData.length})`,
			);

			const response = await fetch(url, {
				headers: {
					"User-Agent": "YuuOuRou Blog",
					Accept: "application/json",
				},
			});

			if (!response.ok) {
				throw new Error(
					`[Bangumi] Failed to fetch data (status: ${response.status}): ${url}`,
				);
			}

			const data = (await response.json()) as UserSubjectCollectionResponse;
			const currentBatch = data.data || [];

			if (currentBatch.length > 0) {
				allData = allData.concat(currentBatch);
				offset += limit;

				// 如果本次获取的数据少于limit，说明已经是最后一页
				if (currentBatch.length < limit) {
					hasMore = false;
				}
			} else {
				hasMore = false;
			}

			// 添加延迟避免请求过于频繁
			if (hasMore) {
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		console.log(`[Bangumi] Fetched ${allData.length} items in total`);
		return allData;
	}

	// 获取所有启用分类的数据
	const bangumiData: Record<string, UserSubjectCollection[]> = {};
	const tabs: Array<{ id: string; name: string; count: number }> = [];
	let fetchFailed = false;

	// 检查是否已配置 Bangumi 用户ID
	const isUserIdConfigured =
		bangumiConfig.username &&
		bangumiConfig.username !== "you-user-id" &&
		bangumiConfig.username.trim() !== "";

	if (!isUserIdConfigured) {
		console.log("[Bangumi] ⚠️ Bangumi user ID not configured, skipping fetch");
	} else if (!isDynamic) {
		console.log("[Bangumi] 🌐 Fetching data from API (static mode)");
	}

	if (!isDynamic) {
		for (const [categoryKey, enabled] of Object.entries(
			bangumiConfig.categories,
		)) {
			// 如果未配置用户ID，跳过数据获取
			if (!isUserIdConfigured) {
				break;
			}
			if (enabled && categoryMap[categoryKey as keyof typeof categoryMap]) {
				const categoryInfo =
					categoryMap[categoryKey as keyof typeof categoryMap];
				try {
					const data = await fetchBangumiData(
						// biome-ignore lint/style/noNonNullAssertion: Checked by isUserIdConfigured
						bangumiConfig.username!,
						categoryInfo.subjectType,
					);
					// NSFW 拦截：hide 模式下过滤掉 NSFW 条目，保持标签页计数一致
					const filteredData = filterNsfw(
						data,
						bangumiConfig.nsfw,
						isBangumiNsfw,
					);
					bangumiData[categoryKey] = filteredData;
					tabs.push({
						id: categoryKey,
						name: categoryInfo.name,
						count: filteredData.length,
					});
				} catch (error) {
					console.error(
						`[Bangumi] Failed to fetch ${categoryInfo.name} data:`,
						error,
					);
					fetchFailed = true;
					break;
				}
			}
		}

		// 根据 categoryOrder 配置对 tabs 进行排序
		const categoryOrder = siteConfig.bangumi?.categoryOrder || [];
		if (categoryOrder.length > 0) {
			tabs.sort((a, b) => {
				const aIndex = categoryOrder.indexOf(
					a.id as (typeof categoryOrder)[number],
				);
				const bIndex = categoryOrder.indexOf(
					b.id as (typeof categoryOrder)[number],
				);
				// 如果类型在配置中，按配置顺序排序；否则排在后面
				if (aIndex === -1 && bIndex === -1) return 0;
				if (aIndex === -1) return 1;
				if (bIndex === -1) return -1;
				return aIndex - bIndex;
			});
		}
	} // end if (!isDynamic)

	const activeTab = tabs[0]?.id || "anime";
	return {
		buildTime,
		bangumiConfig,
		isDynamic,
		isUserIdConfigured,
		tabs,
		bangumiData,
		fetchFailed,
		activeTab,
	};
}
