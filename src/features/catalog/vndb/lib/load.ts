/**
 * VndbPage 页面数据（构建期）。
 * 页面只负责布局与开关判断；取数、过滤、失败标记都在这里。
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { siteConfig } from "@/shared/config/siteConfig";
import "@/shared/styles/common.css";
import "@/features/catalog/styles/media-grid.css";
import { isVndbNsfw } from "@/features/catalog/lib/nsfw";
import {
	buildVndbTabs,
	fetchVndbUlist,
	type VndbTab,
} from "@/features/catalog/vndb/lib/vndb";
import type { VndbUlistEntry } from "@/features/catalog/vndb/types";
import { formatDateI18n } from "@/shared/lib/format/date";

export async function loadVndbPageData() {
	// 检查页面是否启用

	const buildTime = formatDateI18n(new Date());

	////////////// VNDB 配置 ////////////////////////
	const vndbConfig = {
		userId: siteConfig.vndb?.userId || "",
		mode: (siteConfig.vndb?.mode || "static") as "static" | "dynamic",
		downloadCovers: siteConfig.vndb?.downloadCovers ?? false,
		apiUrl: siteConfig.vndb?.apiUrl || "https://api.vndb.org/kana",
		vnBaseUrl: siteConfig.vndb?.vnBaseUrl || "https://vndb.org/",
		apiToken: siteConfig.vndb?.apiToken || "",
		pagination: {
			limit: 100,
			delay: 100,
			maxTotal: 1000,
		},
		// NSFW 处理："off" | "blur" | "hide"
		nsfw: (siteConfig.vndb?.nsfw ?? "blur") as "off" | "blur" | "hide",
	};
	//////////////////////////////////////////////////

	const isDynamic = vndbConfig.mode === "dynamic";
	const isUserIdConfigured =
		vndbConfig.userId.trim() !== "" && vndbConfig.userId !== "you-user-id";

	const vndbData: Record<string, VndbUlistEntry[]> = {};
	const tabs: VndbTab[] = [];
	let fetchFailed = false;

	if (!isDynamic && isUserIdConfigured) {
		const { limit, delay, maxTotal } = vndbConfig.pagination;
		let allItems: VndbUlistEntry[] = [];
		let page = 1;
		const isDev = import.meta.env.DEV;
		const maxPages = isDev ? 1 : 0;

		try {
			while (true) {
				if (maxTotal > 0 && allItems.length >= maxTotal) break;
				if (isDev && maxPages > 0 && allItems.length >= limit * maxPages) break;

				const data = await fetchVndbUlist({
					apiUrl: vndbConfig.apiUrl,
					userId: vndbConfig.userId,
					apiToken: vndbConfig.apiToken,
					results: limit,
					page,
				});
				const batch = data.results || [];
				allItems.push(...batch);

				if (!data.more || batch.length < limit) break;
				page += 1;
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
			// NSFW 拦截：hide 模式下过滤掉 NSFW 条目，保持标签页计数一致
			if (vndbConfig.nsfw === "hide") {
				allItems = allItems.filter((item) => !isVndbNsfw(item));
			}

			if (vndbConfig.downloadCovers) {
				for (const item of allItems) {
					const localCover = path.join(
						process.cwd(),
						"public",
						"vndb-covers",
						`${item.id}.webp`,
					);
					if (existsSync(localCover) && item.vn?.image) {
						item.vn.image.url = `/vndb-covers/${item.id}.webp`;
					}
				}
			}

			vndbData.all = allItems;
			tabs.push(...buildVndbTabs(allItems));
		} catch (error) {
			console.error("[VNDB] Failed to fetch data:", error);
			fetchFailed = true;
		}
	}

	const activeTab = tabs[0]?.id || "all";

	return {
		buildTime,
		vndbConfig,
		isDynamic,
		isUserIdConfigured,
		vndbData,
		tabs,
		fetchFailed,
		activeTab,
	};
}
