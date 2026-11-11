// 微信读书（图书页）配置类型

export interface WereadConfig {
	// 是否启用图书页；关闭后导航菜单自动隐藏，/books/ 跳 404
	enable: boolean;

	// 微信读书 API Key（wrk- 开头），仅在构建/服务端读取，不会进入浏览器产物
	apiKey: string;

	// 网关版本号，需与微信读书官方 Skill 的版本一致；报 upgrade_info 时按提示调高
	skillVersion?: string;

	// 页面标题，留空则使用 i18n 中的翻译
	title?: string;

	// 页面描述文本，留空则使用 i18n 中的翻译
	description?: string;

	// 书架最多展示多少本，0 表示全部展示
	limit?: number;

	// 是否显示顶部的阅读统计条（本月 / 累计 / 日均 / 读完）
	showStats?: boolean;

	// 是否显示阅读时间热力图（页面顶部横幅的主体），默认 true
	showHeatmap?: boolean;

	// 热力图往回取多少年（含当年），默认 3；只保留有记录的年份
	heatmapYears?: number;

	// 是否补全书籍详情（简介 / 字数 / 评分），默认 true。
	// 每本书要额外发 2 个请求，书架很大时可以关掉来加快构建
	showDetail?: boolean;

	// 请求超时时间（毫秒），超时后页面降级为空书架而非构建失败
	timeout?: number;

	// 是否启用本地缓存，默认 true。
	// 关掉后每次构建都会真的打网关；注意 astro dev 下无论怎么配都只读缓存，
	// 因为本地调试会频繁刷新页面，不能让它反复请求。
	cache?: boolean;

	// 统一缓存新鲜期（小时）。不填或填 0 时按接口分档：
	// 书架 6h、本月统计 2h、累计与年度统计 12h、书籍详情 30 天。
	// 仅对构建生效；astro dev 下新鲜期视为无限，要更新请跑 pnpm books:refresh
	cacheTtl?: number;

	// 网关抓取失败（超时 / 限流 / errcode）时，过期缓存还能继续用多少天，默认 30。
	// 设为 0 表示不留旧数据，抓不到就降级为空书架
	cacheStaleDays?: number;

	// 缓存目录，默认 cache/weread（相对项目根目录，已被 .gitignore 忽略）
	cacheDir?: string;
}
