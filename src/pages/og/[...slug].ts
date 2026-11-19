import type { CollectionEntry } from "astro:content";
import { getCollection } from "astro:content";
import type { APIContext, GetStaticPaths } from "astro";
import { renderPostOgImage, shouldGenerateOgImages } from "@/features/og";
import { publishedPosts } from "@/shared/lib/content/content-utils";
import { removeFileExtension } from "@/shared/lib/seo/url";

// OG 图在构建期生成并落 dist/，运行期不再渲染（抓取器超时只有 3 秒）
export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
	if (!shouldGenerateOgImages()) return [];

	const posts = publishedPosts(await getCollection("posts"));
	return posts.map((post) => ({
		// 路由参数带 .png，匹配 /og/<slug>.png
		params: { slug: `${removeFileExtension(post.id)}.png` },
		props: { post },
	}));
};

export async function GET({
	props,
}: APIContext<{ post: CollectionEntry<"posts"> }>): Promise<Response> {
	return renderPostOgImage(props.post);
}
