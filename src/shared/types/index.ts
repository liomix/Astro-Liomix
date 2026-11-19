// 跨域共享类型。域自己的类型在 features/<域>/types.ts。

export type { AnnouncementConfig } from "./announcementConfig";
export type {
	BackgroundWallpaperConfig,
	FullscreenWallpaperLayout,
} from "./backgroundWallpaperConfig";
export type {
	CommentApiConfig,
	CommentEmojiConfig,
	CommentEmojiFile,
	CommentEmojiItem,
	CommentEmojiPack,
	CommentEmojiSource,
	CommentWallpaperConfig,
	CommentWallpaperItem,
} from "./comments";
export type {
	ExpressiveCodeConfig,
	LanguageLogoColor,
	PluginCollapsibleConfig,
	PluginLanguageBadgeConfig,
	PluginLanguageLogoConfig,
} from "./expressiveCodeConfig";
export type {
	BuiltinFontProvider,
	CustomFontProvider,
	FontDefinition,
	FontSelectionConfig,
} from "./fontConfig";
export type { FriendLink, FriendsPageConfig } from "./friendsConfig";
export type { LikeApiConfig } from "./likes";
export type { LocationApiConfig } from "./locationApiConfig";
export type { MermaidConfig, MermaidThemeName } from "./mermaidConfig";
export type { PlantUMLConfig } from "./plantumlConfig";
export type { ProfileConfig, ProfileStatus } from "./profileConfig";
export type {
	AdConfig,
	DynamicWidgetConfig,
	MobileBottomComponentConfig,
	SidebarLayoutConfig,
	SiteInfoConfig,
	WidgetComponentConfig,
	WidgetComponentType,
	WidgetSpecificConfig,
} from "./sidebarConfig";
export type {
	Favicon,
	LightDarkMode,
	NavbarMode,
	SiteConfig,
	WallpaperMode,
} from "./siteConfig";
export type { WelcomeConfig } from "./welcomeConfig";
export type { WidePageConfig } from "./widePageConfig";

/** 响应式图像布局类型 */
export type ResponsiveImageLayout = "constrained" | "full-width" | "none";

/** 图像格式类型 */
export type ImageFormat = "avif" | "webp" | "png" | "jpg" | "jpeg" | "gif";
