import type { ArticlePurityConfig } from "../types/articlePurityConfig";

/**
 * 文章页纯净模式：只留目录，目录移到左列，右列给竖版标签栏
 */
export const articlePurityConfig: ArticlePurityConfig = {
	// 是否启用。关闭后文章页恢复成左右侧栏完整布局
	enable: true,

	// 唯一保留的卡片：文章目录（它在 sidebarConfig 的 rightComponents 里）
	keepWidgets: ["sidebarToc"],

	// 多标签导航栏改竖版钉在右列（关掉则右列保持空白）
	sideTabBar: true,
};
