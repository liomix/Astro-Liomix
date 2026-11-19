import type { APIContext } from "astro";
import { profileConfig } from "@/shared/config/profileConfig";
import { siteConfig } from "@/shared/config/siteConfig";
import { getSortedPosts } from "@/shared/lib/content/content-utils";
import {
	buildAtomFeed,
	renderFeedEntries,
} from "@/shared/lib/content/feed-utils";
import pkg from "../../package.json";

export const prerender = true;

export async function GET(context: APIContext): Promise<Response> {
	const includeContent = (siteConfig.feed?.contentMode ?? "full") === "full";
	const blog = await getSortedPosts();
	const entries = await renderFeedEntries(blog, { includeContent });
	const site = context.site ?? new URL(siteConfig.site_url);
	const xml = buildAtomFeed({
		site,
		title: siteConfig.title,
		subtitle: siteConfig.subtitle || siteConfig.description || "",
		entries,
		authorName: profileConfig.name,
		generator: `Firefly v${pkg.version}`,
		includeContent,
	});
	return new Response(xml, {
		headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
	});
}
