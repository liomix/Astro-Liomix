/**
 * 站点访问量统计配置：对接自建统计后端（`GET/POST /api/v1/count/site*`）。
 *
 * 前端只负责「上报一次访问」和「把数字回填到卡片」，计数与去重都在后端完成。
 */
export type SiteStatsConfig = {
	/** 是否启用站点访问量统计（左侧栏「站点统计」卡片中的访问量与访客数） */
	enable: boolean;
	/** 后端 API 基地址，末尾不要带斜杠；部署后改成公网地址 */
	apiBaseUrl: string;
	/** 是否上报访问。关闭后只读取已有计数，不会增加访问量 */
	reportVisit: boolean;
	/** Swup 切页时是否也计一次访问（按 PV 语义默认开启） */
	countOnSwap: boolean;
	/** 是否启用文章阅读量：卡片上用它替换分类，文章页也会显示并上报一次浏览 */
	articleViews: boolean;
	/** 请求超时（毫秒）。统计失败不影响页面，卡片保持占位符「—」 */
	requestTimeoutMs: number;
};
