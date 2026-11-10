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

	// 是否把「已读完但移出书架」的书一起放进书架，默认 true
	includeFinished?: boolean;

	// 是否显示顶部的阅读统计条（本月 / 累计 / 日均 / 读完）
	showStats?: boolean;

	// 请求超时时间（毫秒），超时后页面降级为空书架而非构建失败
	timeout?: number;
}
