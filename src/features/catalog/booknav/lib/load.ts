/**
 * 书签导航页数据（构建期）。
 * 页面只负责布局与开关判断：分组解析、favicon 兜底、计数都在这里。
 */
import { booknavPageConfig } from "@/features/catalog/booknav/config";
import I18nKey from "@/shared/i18n/i18nKey";
import { i18n } from "@/shared/i18n/translation";
import "@/shared/styles/common.css";
import {
	getBooknavDomain,
	getBooknavLetter,
	getEnabledBooknavGroups,
	resolveBooknavIcon,
} from "@/features/catalog/booknav/lib/booknav";

export async function loadBooknavPageData() {
	// 检查页面是否启用

	// 使用配置文件中的书签数据，按权重排序
	const groups = getEnabledBooknavGroups();

	// 预先解析每个书签的图标与域名，避免在模板里重复计算
	const resolvedGroups = groups.map((group) => ({
		...group,
		items: group.items.map((item) => ({
			...item,
			domain: getBooknavDomain(item.url),
			letter: getBooknavLetter(item.title),
			resolvedIcon: resolveBooknavIcon(item, booknavPageConfig.favicon),
		})),
	}));

	const totalCount = resolvedGroups.reduce((sum, g) => sum + g.items.length, 0);

	// 页面标题和描述
	const title = booknavPageConfig.title || i18n(I18nKey.booknav);
	const description =
		booknavPageConfig.description || i18n(I18nKey.booknavDescription);

	return { groups, resolvedGroups, totalCount, title, description };
}
