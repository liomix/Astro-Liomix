/**
 * 条目库域：bangumi / mal / vndb / bilibili / gallery / projects / booknav。
 * 父域提供网格、NSFW 过滤、失败封面兜底等共用件；各子包对外只从这里取。
 */

// 组件
export { default as BangumiCard } from "./bangumi/components/BangumiCard.svelte";
export { default as BangumiGrid } from "./bangumi/components/BangumiGrid.svelte";
export { default as BangumiSection } from "./bangumi/components/BangumiSection.svelte";
// 工具 / 契约
export type {
	CollectionType,
	SlimSubject,
	SubjectImages,
	SubjectTag,
	SubjectType,
	UserSubjectCollection,
	UserSubjectCollectionResponse,
} from "./bangumi/types";
export { default as BilibiliCard } from "./bilibili/components/BilibiliCard.svelte";
export { default as BilibiliDetailModal } from "./bilibili/components/BilibiliDetailModal.svelte";
export { default as BilibiliGrid } from "./bilibili/components/BilibiliGrid.svelte";
export type { BilibiliItem } from "./bilibili/lib/bilibili";
export { fetchBilibiliList } from "./bilibili/lib/bilibili";
export type { StandardizedAnime } from "./bilibili/types";
export { booknavConfig, booknavPageConfig } from "./booknav/config";
export type { ResolvedBooknavIcon } from "./booknav/lib/booknav";
export {
	buildFaviconUrl,
	getBooknavDomain,
	getBooknavLetter,
	getEnabledBooknavGroups,
	resolveBooknavIcon,
} from "./booknav/lib/booknav";
export type {
	BooknavFaviconConfig,
	BooknavGroup,
	BooknavItem,
	BooknavPageConfig,
} from "./booknav/types";
export { default as AlbumCard } from "./gallery/components/AlbumCard.astro";
export { default as PhotoCard } from "./gallery/components/PhotoCard.astro";
export { galleryConfig } from "./gallery/config";
export { getAlbumCover, scanAlbumPhotos } from "./gallery/lib/gallery";
export type { GalleryAlbum, GalleryConfig } from "./gallery/types";
export { getFailedCovers, markCoverFailed } from "./lib/failed-covers";
export { filterNsfw, isBangumiNsfw, isMalNsfw, isVndbNsfw } from "./lib/nsfw";
export { default as MalCard } from "./mal/components/MalCard.svelte";
export { default as MalGrid } from "./mal/components/MalGrid.svelte";
export { default as MalSection } from "./mal/components/MalSection.svelte";
export type { MalCategory, MalFetchOptions, MalListKind } from "./mal/lib/mal";
export {
	fetchMalList,
	getMalSeasonText,
	getMalStatusOrder,
	getMalStatusText,
	MAL_ANIME_FIELDS,
	MAL_MANGA_FIELDS,
} from "./mal/lib/mal";
export type {
	MalAlternativeTitles,
	MalGenre,
	MalListItem,
	MalListResponse,
	MalListStatus,
	MalMainPicture,
	MalNode,
	MalStartSeason,
} from "./mal/types";
export { default as ProjectCard } from "./projects/components/ProjectCard.astro";
export type { ResolvedLinkIcon } from "./projects/lib/projects";
export {
	getProjectStatusMeta,
	PROJECT_STATUS_KEYS,
	resolveLinkIcon,
	resolveProjectImage,
	resolveProjectImageAbsolute,
} from "./projects/lib/projects";
// 类型
export type { NsfwMode } from "./types";
export { default as VndbCard } from "./vndb/components/VndbCard.svelte";
export { default as VndbGrid } from "./vndb/components/VndbGrid.svelte";
export { default as VndbSection } from "./vndb/components/VndbSection.svelte";
export type { VndbTab, VndbUlistFetchOptions } from "./vndb/lib/vndb";
export {
	buildVndbTabs,
	fetchVndbUlist,
	formatVndbLength,
	getVndbItemsForTab,
	getVndbLengthText,
	getVndbStatusText,
	normalizeVndbLabel,
	VNDB_ULIST_FIELDS,
} from "./vndb/lib/vndb";
export type {
	VndbImage,
	VndbListLabel,
	VndbProducer,
	VndbTag,
	VndbUlistEntry,
	VndbUlistResponse,
	VndbVisualNovel,
} from "./vndb/types";
