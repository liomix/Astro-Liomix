/**
 * 哔哩哔哩追番页数据（构建期）
 * ---------------------------------------------------------------------------
 * 未配置 UID 时返回空列表 + isConfigured=false，由页面渲染「去配置」提示；
 * 抓取失败只记日志并保留空列表 —— 这一页的主体是「有没有数据」，
 * 失败时统计卡显示 0，比整页 500 更可用。
 */
import { siteConfig } from "@/shared/config/siteConfig";
import { formatDateI18n } from "@/shared/lib/format/date";
import type { StandardizedAnime } from "../types";
import { fetchBilibiliList } from "./bilibili";

export interface BilibiliPageData {
	buildTime: string;
	isConfigured: boolean;
	animeList: StandardizedAnime[];
	totalCount: number;
	averageRating: string;
}

export async function loadBilibiliPageData(): Promise<BilibiliPageData> {
	const buildTime = formatDateI18n(new Date());
	const uid = siteConfig.bilibili?.uid;
	const isConfigured = !!uid && uid.trim() !== "";

	let animeList: StandardizedAnime[] = [];
	if (isConfigured) {
		try {
			animeList = await fetchBilibiliList(uid);
			console.log(`[Bilibili] Page data: ${animeList.length} items`);
		} catch (error) {
			console.error("[Bilibili] Failed to fetch data:", error);
		}
	}

	const totalCount = animeList.length;
	const averageRating =
		animeList.length > 0
			? (
					animeList.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) /
					animeList.length
				).toFixed(1)
			: "0.0";

	return { buildTime, isConfigured, animeList, totalCount, averageRating };
}
