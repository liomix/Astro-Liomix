/**
 * 栏目（导航）域：菜单注册表、导航栏、下拉菜单、多标签栏与导航页外壳策略。
 * 子域（guestbook / books）不从这里转导出，页面直接 import 子域。
 */

// 组件
export { default as DropdownItem } from "./components/DropdownItem.astro";
export { default as DropdownMenu } from "./components/DropdownMenu.astro";
export { default as DropdownPanel } from "./components/DropdownPanel.astro";
export { default as HeaderTopRow } from "./components/HeaderTopRow.astro";
export { default as Navbar } from "./components/Navbar.astro";
export { default as NavLottieLogo } from "./components/NavLottieLogo.svelte";
export { default as NavMenuPanel } from "./components/NavMenuPanel.astro";
export { default as TabBar } from "./components/TabBar.astro";

// 配置
export {
	linkPresets,
	navBarConfig,
	navBarSearchConfig,
	navPurityConfig,
} from "./config";
// 工具 / 契约
export { resolveNavbarLinks, resolveNavbarName } from "./lib/nav-i18n";
export { resolveNavMenuLinks } from "./lib/nav-menu";
export {
	collectNavPurityPaths,
	matchesPathScope,
	toNavPurityPath,
} from "./lib/nav-purity";
export {
	getCurrentPath,
	isHomePage,
	isPostPage,
	isSwupReady,
	navigateToPage,
	pathsEqual,
} from "./lib/nav-utils";
export { resolvePageToggles } from "./lib/page-toggle";
// 类型
export type {
	NavBarConfig,
	NavBarLink,
	NavBarSearchConfig,
	NavBarSearchMethod,
	NavPurityConfig,
} from "./types";
