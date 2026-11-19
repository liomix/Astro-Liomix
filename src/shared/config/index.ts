// 跨域配置的统一出口。
// 域自己的配置在 features/<域>/config.ts，不在这里。

import type { NavbarMode } from "../types/siteConfig";
import { siteConfig } from "./siteConfig";

/** 解析导航栏模式：navbarMode 优先，否则按旧 stickyNavbar 兼容映射（true→fixed，false→static） */
export function resolveNavbarMode(navbar: {
	navbarMode?: NavbarMode;
	stickyNavbar?: boolean;
}): NavbarMode {
	if (navbar.navbarMode) return navbar.navbarMode;
	return navbar.stickyNavbar === false ? "static" : "fixed";
}

/** 当前导航栏模式（已按 navbarMode / 旧 stickyNavbar 解析），供各消费方统一读取 */
export const navbarMode: NavbarMode = resolveNavbarMode(siteConfig.navbar);

export { announcementConfig } from "./announcementConfig";
export { backgroundWallpaperConfig } from "./backgroundWallpaperConfig";
export {
	BANNER_HEIGHT,
	BANNER_HEIGHT_EXTEND,
	BANNER_HEIGHT_HOME,
	BANNER_HEIGHT_NON_HOME,
	BANNER_HEIGHT_NON_HOME_MIN,
	DEFAULT_THEME,
	LIGHT_MODE,
	PAGE_SIZE,
	PAGE_WIDTH,
	WALLPAPER_BANNER,
} from "./constants";
export { expressiveCodeConfig } from "./expressiveCodeConfig";
export { fontConfig, fontsList } from "./fontConfig";
export {
	friendsConfig,
	friendsPageConfig,
	getEnabledFriends,
} from "./friendsConfig";
export { defaultFavicons } from "./icon";
export { locationApiConfig } from "./locationApiConfig";
export { mermaidConfig } from "./mermaidConfig";
export { plantumlConfig } from "./plantumlConfig";
export { profileConfig } from "./profileConfig";
export { sidebarLayoutConfig } from "./sidebarConfig";
export { siteConfig } from "./siteConfig";
export { welcomeConfig } from "./welcomeConfig";
export { widePageConfig } from "./widePageConfig";
