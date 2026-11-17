// 配置索引文件 - 统一导出所有配置
// 这样组件可以一次性导入多个相关配置，减少重复的导入语句

import type { NavbarMode } from "../types/siteConfig";
import { siteConfig } from "./siteConfig"; // 站点基础配置（用于派生 navbarMode）

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

export type {
	CommentWallpaperConfig,
	CommentWallpaperItem,
} from "../types/commentWallpaperConfig"; // 评论区壁纸类型
// 类型导出
export type {
	AdConfig,
	AnnouncementConfig,
	BackgroundWallpaperConfig,
	BooknavFaviconConfig,
	BooknavGroup,
	BooknavItem,
	BooknavPageConfig,
	CoverImageConfig,
	DisplaySettingsConfig,
	DynamicConfig,
	ExpressiveCodeConfig,
	GalleryAlbum,
	GalleryConfig,
	LicenseConfig,
	MermaidConfig,
	MusicPlayerConfig,
	NavBarConfig,
	PlantUMLConfig,
	ProfileConfig,
	SakuraConfig,
	SidebarLayoutConfig,
	SiteConfig,
	SponsorConfig,
	WidgetComponentConfig,
	WidgetComponentType,
	WidgetSpecificConfig,
} from "../types/config";
export type {
	BuiltinFontProvider,
	CustomFontProvider,
	FontDefinition,
	FontSelectionConfig,
} from "../types/fontConfig"; // 字体类型定义
export type { SiteStatsConfig } from "../types/siteStatsConfig"; // 站点访问量统计类型
export type { CommentApiConfig } from "../types/commentApiConfig"; // 评论接口类型
export type { NavPurityConfig } from "../types/navPurityConfig"; // 导航页纯净模式类型
export type { WidePageConfig } from "../types/widePageConfig"; // 宽幅页面布局类型
export type { ArticlePurityConfig } from "../types/articlePurityConfig"; // 文章页纯净模式类型
export { announcementConfig } from "./announcementConfig"; // 公告配置
// 样式配置
export { backgroundWallpaperConfig } from "./backgroundWallpaperConfig"; // 背景壁纸配置
export { booknavConfig, booknavPageConfig } from "./booknavConfig"; // 书签导航配置
// 功能配置
export { commentApiConfig } from "./commentApiConfig"; // 评论接口配置
export {
	COMMENT_WALLPAPER_STORAGE_KEY,
	commentWallpaperConfig,
	getCommentWallpaper,
} from "./commentWallpaperConfig"; // 评论区（动态页评论抽屉）壁纸配置
export { coverImageConfig } from "./coverImageConfig"; // 封面图配置
export { displaySettingsConfig } from "./displaySettingsConfig"; // 显示设置面板开关配置
export { dynamicConfig } from "./dynamicConfig"; // 动态页面配置
export { sakuraConfig } from "./effectsConfig"; // 动画特效配置（樱花等）
export { expressiveCodeConfig } from "./expressiveCodeConfig"; // 代码高亮配置
export { fontConfig, fontsList } from "./fontConfig"; // 字体配置
export { friendsPageConfig, getEnabledFriends } from "./friendsConfig"; // 友链配置
export { galleryConfig } from "./galleryConfig"; // 相册配置
export { licenseConfig } from "./licenseConfig"; // 许可证配置
// 组件配置
export { mermaidConfig } from "./mermaidConfig"; // Mermaid 图表配置
export { musicPlayerConfig } from "./musicConfig"; // 音乐播放器配置
export { navBarConfig, navBarSearchConfig } from "./navBarConfig"; // 导航栏配置与搜索配置
export { navPurityConfig } from "./navPurityConfig"; // 导航页纯净模式（隐藏多标签栏与侧栏卡片）
export { articlePurityConfig } from "./articlePurityConfig"; // 文章页纯净模式（只留目录，标签栏竖排到右侧）
export { widePageConfig } from "./widePageConfig"; // 宽幅页面布局（隐藏侧栏与多标签栏，正文占满）
export { live2dWidgetConfig, spineModelConfig } from "./pioConfig"; // 看板娘配置
export { plantumlConfig } from "./plantumlConfig"; // PlantUML 图表配置
export { profileConfig } from "./profileConfig"; // 用户资料配置
// 布局配置
export { sidebarLayoutConfig } from "./sidebarConfig"; // 侧边栏布局配置
// 核心配置
export { siteConfig } from "./siteConfig"; // 站点基础配置
export { siteStatsConfig } from "./siteStatsConfig"; // 站点访问量统计配置
export { sponsorConfig } from "./sponsorConfig"; // 打赏配置
export { welcomeConfig } from "./welcomeConfig"; // 访客欢迎信息配置
