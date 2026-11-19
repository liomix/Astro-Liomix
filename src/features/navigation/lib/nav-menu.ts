import { navBarConfig } from "@/features/navigation/config";
import type { NavBarLink } from "@/features/navigation/types";
import { siteConfig } from "@/shared/config/siteConfig";
import { resolveNavbarLinks } from "./nav-i18n";

/** 解析导航栏链接：按 siteConfig.pages 过滤 + i18n 名称解析。Navbar 与 NavMenuPanel 共用。 */
export function resolveNavMenuLinks(): NavBarLink[] {
	const pages = siteConfig.pages;

	function isPageEnabled(link: NavBarLink): boolean {
		if (!link.pageKey) return true;
		return pages[link.pageKey as keyof typeof pages] !== false;
	}

	function filterLinks(link: NavBarLink): NavBarLink | null {
		if (!link.children) {
			return isPageEnabled(link) ? link : null;
		}

		const filteredChildren = link.children.filter(isPageEnabled);

		if (filteredChildren.length === 0) return null;
		if (filteredChildren.length === 1) return filteredChildren[0];
		return { ...link, children: filteredChildren };
	}

	return resolveNavbarLinks(
		navBarConfig.links
			.map(filterLinks)
			.filter((link): link is NavBarLink => link !== null),
	);
}
