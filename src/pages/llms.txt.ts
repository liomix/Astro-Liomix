import type { APIRoute } from "astro";
import { siteConfig } from "@/shared/config/siteConfig";
import I18nKey from "@/shared/i18n/i18nKey";
import { i18n } from "@/shared/i18n/translation";
import { getSortedPosts } from "@/shared/lib/content/content-utils";
import { url } from "@/shared/lib/seo/url";

export const prerender = true;

const RECENT_POSTS_COUNT = 20;

type KeyPage = {
	labelKey: I18nKey;
	path: string;
	descKey?: I18nKey;
	pageKey?: keyof typeof siteConfig.pages;
};

// 主要页面：首页 / 归档始终包含；其余按 siteConfig.pages 开关过滤
const KEY_PAGES: KeyPage[] = [
	{ labelKey: I18nKey.home, path: "/" },
	{ labelKey: I18nKey.archive, path: "/archive/" },
	{
		labelKey: I18nKey.friends,
		path: "/friends/",
		descKey: I18nKey.friendsDescription,
		pageKey: "friends",
	},
	{
		labelKey: I18nKey.guestbook,
		path: "/guestbook/",
		descKey: I18nKey.guestbookDescription,
		pageKey: "guestbook",
	},
	{
		labelKey: I18nKey.books,
		path: "/books/",
		descKey: I18nKey.booksDescription,
		pageKey: "books",
	},
	{
		labelKey: I18nKey.dynamic,
		path: "/dynamic/",
		descKey: I18nKey.dynamicDescription,
		pageKey: "dynamic",
	},
];

export const GET: APIRoute = async ({ site }) => {
	const base = site ?? new URL(siteConfig.site_url);
	const abs = (path: string) => new URL(url(path), base).href;

	const enabledPages = KEY_PAGES.filter(
		(pageEntry) => !pageEntry.pageKey || siteConfig.pages[pageEntry.pageKey],
	);
	const posts = await getSortedPosts();
	const recentPosts = posts.slice(0, RECENT_POSTS_COUNT);

	const lines: string[] = [
		`# ${siteConfig.title}`,
		`> ${siteConfig.description || siteConfig.subtitle || ""}`,
		"",
		"## Key Pages",
	];
	for (const pageEntry of enabledPages) {
		const label = i18n(pageEntry.labelKey);
		const link = abs(pageEntry.path);
		const desc = pageEntry.descKey ? i18n(pageEntry.descKey) : "";
		lines.push(
			desc ? `- [${label}](${link}): ${desc}` : `- [${label}](${link})`,
		);
	}
	lines.push("", "## Recent Posts");
	for (const post of recentPosts) {
		const link = abs(url(`/posts/${post.id}/`));
		const desc = post.data.description || "";
		lines.push(
			desc
				? `- [${post.data.title}](${link}): ${desc}`
				: `- [${post.data.title}](${link})`,
		);
	}

	const body = `${lines.join("\n")}\n`;
	// 前置 UTF-8 BOM：静态托管或 Windows 编辑器对无 BOM 的 .txt 默认按本地编码(ANSI/GBK)解码，
	// BOM 使浏览器与编辑器都能稳定识别为 UTF-8，避免中文乱码。
	return new Response(`﻿${body}`, {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
};
