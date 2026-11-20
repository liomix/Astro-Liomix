import {
	type NavBarConfig,
	type NavBarLink,
	type NavBarSearchConfig,
	NavBarSearchMethod,
} from "@/features/navigation/types";

// ============================================================================
// 导航栏配置 - 根据顺序动态生成导航栏链接
// NavBar Configuration - Dynamically generate navigation bar links based on order
// ============================================================================
const getDynamicNavBarConfig = (): NavBarConfig => {
	// 基础导航栏链接
	const links: NavBarLink[] = [];

	// 我的及其子菜单（导航栏第一项）
	links.push({
		name: "我的",
		url: "#",
		icon: "material-symbols:person",
		children: [
			// 图书（微信读书书架）
			linkPresets.Books,

			// 动态
			linkPresets.Dynamic,
		],
	});

	// 文章及其子菜单
	links.push({
		name: "文章",
		url: "#",
		icon: "material-symbols:article",
		children: [
			// 归档
			linkPresets.Archive,

			// 分类
			linkPresets.Categories,

			// 标签
			linkPresets.Tags,

			// 系列
			linkPresets.Series,
		],
	});

	//社交及其子菜单
	links.push({
		name: "社交",
		url: "#",
		icon: "material-symbols:group",
		children: [
			// 友链
			linkPresets.Friends,

			// 留言
			linkPresets.Guestbook,
		],
	});

	// 自定义导航栏链接
	links.push({
		name: "链接",
		url: "#",
		icon: "material-symbols:link",
		// 子菜单
		children: [
			{
				name: "GitHub",
				url: "https://github.com/CuteLeaf/Firefly",
				external: true,
				icon: "fa7-brands:github",
			},
			{
				name: "Gitee",
				url: "https://gitee.com/CuteLeaf/Firefly",
				external: true,
				icon: "fa7-brands:gitee",
			},
			{
				name: "Firefly文档",
				url: "https://docs-firefly.cuteleaf.cn",
				external: true,
				icon: "material-symbols:docs",
			},
		],
	});

	// 文档链接
	// links.push({
	// 	name: "文档",
	// 	url: "https://docs-firefly.cuteleaf.cn",
	// 	external: true,
	// 	icon: "material-symbols:docs",
	// });

	return { links } as NavBarConfig;
};

// 导航搜索配置
export const navBarSearchConfig: NavBarSearchConfig = {
	method: NavBarSearchMethod.PageFind,
};

// ============================================================================
// 链接预设 - 可自由自定义导航栏链接的名称、图标和URL
// Link Presets - Allows free customization of the name, icon, and URL of navigation bar links
// ============================================================================
export const linkPresets: Record<string, NavBarLink> = {
	Home: {
		name: "主页",
		url: "/",
		icon: "material-symbols:home",
	},
	Archive: {
		name: "归档",
		url: "/archive/",
		icon: "material-symbols:archive",
	},
	Categories: {
		name: "分类",
		url: "/categories/",
		icon: "material-symbols:folder-open-rounded",
	},
	Tags: {
		name: "标签",
		url: "/tags/",
		icon: "material-symbols:tag-rounded",
	},
	Series: {
		name: "系列",
		url: "/series/",
		icon: "material-symbols:layers",
	},
	Friends: {
		name: "友链",
		url: "/friends/",
		icon: "material-symbols:link-2-rounded",
		pageKey: "friends",
	},
	Guestbook: {
		name: "留言",
		url: "/guestbook/",
		icon: "material-symbols:chat",
		pageKey: "guestbook",
	},
	Dynamic: {
		name: "动态",
		url: "/dynamic/",
		icon: "material-symbols:forum-rounded",
		pageKey: "dynamic",
	},
	Books: {
		name: "图书",
		url: "/books/",
		icon: "material-symbols:auto-stories",
		pageKey: "books",
	},
};

export const navBarConfig: NavBarConfig = getDynamicNavBarConfig();

import type { NavPurityConfig } from "@/features/navigation/types";

/**
 * 导航页纯净模式：导航栏里的页面只留正文 + 个人资料卡，宽度保持不变
 */
export const navPurityConfig: NavPurityConfig = {
	// 是否启用。关闭后所有页面恢复成多标签栏 + 完整侧栏
	enable: true,

	// 纯净模式下唯一保留的卡片：个人资料
	// （想连资料卡也藏起来，把这个数组清空即可）
	keepWidgets: ["profile"],

	// 导航栏里没列、但也想走纯净模式的页面，例如 "/search/"
	extraPaths: [],

	// 导航栏里有链接、但不该走纯净模式的页面。
	// 留言板在「社交」下拉里，但它要的是自己的大页布局（见 widePageConfig）
	excludePaths: ["/guestbook/"],
};
