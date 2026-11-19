/**
 * 文章页的派生数据：封面、海报图、面包屑、JSON-LD
 * ---------------------------------------------------------------------------
 * 从 `pages/posts/[...slug].astro` 的 frontmatter 里搬出来（那一段原本 200 行）。
 * 页面只该做编排：取 entry、render、把数据交给布局。这里负责「算」——
 * 随机封面、绝对 URL、作者/发布者实体、BlogPosting 结构化数据。
 *
 * 注意：本模块不碰 Astro 全局（`Astro.url` 由调用方以 `pageUrl` 传入），
 * 这样它能在任何 Node 环境里被调用与测试。
 */
import type { CollectionEntry } from "astro:content";
import { coverImageConfig } from "@/features/post/config";
import { profileConfig } from "@/shared/config/profileConfig";
import { siteConfig } from "@/shared/config/siteConfig";
import I18nKey from "@/shared/i18n/i18nKey";
import { i18n } from "@/shared/i18n/translation";
import { getApiUrlList, processCoverImageSync } from "@/shared/lib/media/image";
import {
	buildBreadcrumbList,
	buildPersonEntity,
	buildPublisherEntity,
	toAbsoluteUrl,
} from "@/shared/lib/seo/schema";
import {
	getAuthorAvatarUrl,
	getSiteLogo,
	toAbsoluteImageInfo,
} from "@/shared/lib/seo/schema-image";
import { getCategoryUrl, getFileDirFromPath, url } from "@/shared/lib/seo/url";

export interface PostPagePayloadInput {
	entry: CollectionEntry<"posts">;
	/** 当前页面的绝对地址（`Astro.url.toString()`） */
	pageUrl: string;
	/** remark 统计出来的字数，用于 JSON-LD 的 wordCount */
	wordCount?: number;
}

/** 站内绝对路径补齐成绝对 URL；外链原样返回，认不出的返回 null */
export function directImageUrl(src: string | undefined): string | null {
	if (!src) return null;
	if (
		src.startsWith("http://") ||
		src.startsWith("https://") ||
		src.startsWith("//") ||
		src.startsWith("data:")
	) {
		return src;
	}
	return src.startsWith("/") ? url(src) : null;
}

export interface PostPagePayload {
	processedImage: ReturnType<typeof processCoverImageSync>;
	apiUrls: ReturnType<typeof getApiUrlList>;
	showPostCover: boolean;
	usePostCoverOverlay: boolean;
	coverImage: Awaited<ReturnType<typeof toAbsoluteImageInfo>> | undefined;
	posterCoverUrl: string | null;
	posterCoverSelector: string | null;
	posterAvatarUrl: string | null;
	posterAvatarSelector: string | null;
	jsonLd: Record<string, unknown>;
}

export async function buildPostPagePayload({
	entry,
	pageUrl,
	wordCount,
}: PostPagePayloadInput): Promise<PostPagePayload> {
	// 随机封面：image 为「api」时从配置的图源取一张
	const processedImage = processCoverImageSync(entry.data.image, entry.id);
	const apiUrls = getApiUrlList(entry.data.image, entry.id);
	const showPostCover = Boolean(
		processedImage && coverImageConfig.enableInPost,
	);
	const usePostCoverOverlay =
		showPostCover && (coverImageConfig.enableInPostOverlay ?? true);

	// 海报优先复用页面上已经优化过的图片，本地源路径不再单独导入
	const posterCoverUrl = showPostCover ? null : directImageUrl(processedImage);
	const posterCoverSelector = showPostCover ? "#post-cover img" : null;
	const posterAvatarUrl = directImageUrl(profileConfig.avatar);
	const posterAvatarSelector = profileConfig.avatar
		? ".profile-avatar-image img"
		: null;

	const coverBasePath = getFileDirFromPath(entry.filePath || "");
	const coverImage =
		(await toAbsoluteImageInfo(
			processedImage,
			coverBasePath,
			siteConfig.site_url,
		)) ?? undefined;

	// 作者页已移除：author.url 指向站点首页，与首页 Person 的 @id 保持一致
	const authorUrl =
		toAbsoluteUrl("/", siteConfig.site_url) ?? siteConfig.site_url;

	const authorAvatarUrl = await getAuthorAvatarUrl();
	const authorPerson = buildPersonEntity({
		site: siteConfig.site_url,
		profileConfig,
		authorUrl,
		avatarUrl: authorAvatarUrl,
		description: profileConfig.bio,
	});

	const publisher = buildPublisherEntity({
		site: siteConfig.site_url,
		siteConfig,
		logo: await getSiteLogo(),
	});

	const breadcrumbItems = [
		{
			name: i18n(I18nKey.home),
			url: toAbsoluteUrl("/", siteConfig.site_url) ?? siteConfig.site_url,
		},
	];
	if (entry.data.category) {
		breadcrumbItems.push({
			name: entry.data.category,
			url:
				toAbsoluteUrl(
					getCategoryUrl(entry.data.category),
					siteConfig.site_url,
				) ?? siteConfig.site_url,
		});
	}
	breadcrumbItems.push({ name: entry.data.title, url: pageUrl });

	const jsonLd = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "BlogPosting",
				headline: entry.data.title,
				description: entry.data.description || entry.data.title,
				keywords: entry.data.tags.length
					? entry.data.tags.join(", ")
					: undefined,
				author: { "@id": authorPerson["@id"] },
				publisher: { "@id": publisher["@id"] },
				// 优化：有封面才输出，避免 image: null
				...(coverImage
					? {
							image: {
								"@type": "ImageObject",
								url: coverImage.url,
								contentUrl: coverImage.url,
								...(coverImage.width ? { width: coverImage.width } : {}),
								...(coverImage.height ? { height: coverImage.height } : {}),
							},
						}
					: {}),
				datePublished: entry.data.published.toISOString(),
				...(entry.data.category ? { articleSection: entry.data.category } : {}),
				...(wordCount ? { wordCount } : {}),
				...(entry.data.updated
					? { dateModified: entry.data.updated.toISOString() }
					: {}),
				mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
				url: pageUrl,
				inLanguage: entry.data.lang
					? entry.data.lang.replace("_", "-")
					: siteConfig.lang.replace("_", "-"),
			},
			authorPerson,
			publisher,
			buildBreadcrumbList(breadcrumbItems),
		],
	};

	return {
		processedImage,
		apiUrls,
		showPostCover,
		usePostCoverOverlay,
		coverImage,
		posterCoverUrl,
		posterCoverSelector,
		posterAvatarUrl,
		posterAvatarSelector,
		jsonLd,
	};
}
