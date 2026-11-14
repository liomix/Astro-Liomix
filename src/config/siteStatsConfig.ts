import type { SiteStatsConfig } from "../types/siteStatsConfig";

export const siteStatsConfig: SiteStatsConfig = {
	// 是否启用站点访问量统计
	enable: true,
	// 自建统计后端地址（末尾不要带斜杠）。本地开发指向 Go 服务，部署后改成公网地址
	apiBaseUrl: "http://localhost:8080",
	// 是否上报访问。关掉后只读取已有计数，访问量不会增长
	reportVisit: true,
	// Swup 切页是否也计一次访问。只统计首次进入页面时设为 false
	countOnSwap: true,
	// 文章阅读量：列表卡片上用它替换分类，文章页也会显示并在打开时 +1
	articleViews: true,
	// 请求超时（毫秒）。超时或后端不可用时静默失败，卡片保持「—」
	requestTimeoutMs: 5000,
};
