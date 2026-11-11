import type { WereadConfig } from "@/types/wereadConfig";

// ============================================================================
// 微信读书（图书页）配置
// ----------------------------------------------------------------------------
// 数据来自微信读书官方 Agent Gateway：
//   POST https://i.weread.qq.com/api/agent/gateway
//   Authorization: Bearer wrk-xxxxxxxx
// API Key 在 https://weread.qq.com/r/weread-skills 获取。
//
// 注意：本文件只被图书页（服务端）引用，apiKey 不会被打进浏览器产物。
// 若想改用环境变量，把下面的 apiKey 留空即可，构建时优先读取
// WEREAD_API_KEY（.env 或 CI 环境变量）。
// ============================================================================
export const wereadConfig: WereadConfig = {
	// 图书页开关
	enable: true,

	// 微信读书 API Key，留空则读取环境变量 WEREAD_API_KEY
	apiKey: "",

	// 网关版本号
	skillVersion: "1.0.5",

	// 页面标题，留空则使用 i18n 中的「图书」
	title: "",

	// 页面描述，留空则使用 i18n 中的默认文案
	description: "",

	// 书架最多展示多少本（按最近阅读时间排序），0 表示全部
	// 只同步微信读书书架上的书（在读 / 读完），不从阅读记录、笔记里反推
	limit: 0,

	// 是否显示阅读统计条（本月 / 累计 / 日均 / 读完）
	showStats: true,

	// 是否显示阅读时间热力图（顶部横幅主体，GitHub 贡献图样式）
	showHeatmap: true,

	// 热力图往回取多少年（含当年），只保留有记录的年份
	heatmapYears: 3,

	// 补全书籍详情（简介 / 字数 / 评分）给详情弹窗用。
	// 每本书多 2 个构建期请求，书架很多时可以关掉
	showDetail: true,

	// 请求超时（毫秒）
	timeout: 8000,

	// ── 缓存 ──────────────────────────────────────────────────────────────
	// 数据会缓存在 cache/weread/ 里（已 gitignore），同一份数据不会反复打网关，
	// 减少被限流 / 封 Key 的风险。缓存里只有响应体，不含 API Key。
	// 想立刻看最新数据：临时 `WEREAD_CACHE=off pnpm dev`，或直接删掉 cache/weread/。
	cache: true,

	// 统一缓存新鲜期（小时），0 表示按接口分档：
	// 书架 6h、本月统计 2h、累计 / 年度 12h、书籍详情 30 天
	cacheTtl: 0,

	// 抓取失败时，过期缓存还能继续用多少天（页面不会因网关抽风而空掉）
	cacheStaleDays: 30,

	// 缓存目录（相对项目根），默认 cache/weread
	cacheDir: "cache/weread",
};
