/**
 * 字体配置（统一入口）
 *
 * 所有字体相关配置都在此文件中定义：
 *   详细用法请参考 Astro 官方文档：https://docs.astro.build/en/guides/fonts
 * - fonts：Astro Font API 字体定义（自动下载、缓存、优化加载）
 * - fontConfig：字体选择与区域覆盖
 *
 * 添加新字体只需编辑本文件：
 * 1. 在下方 fonts 数组中添加字体定义
 * 2. 在 fontConfig.selected 或区域字段中引用对应的 cssVariable
 *
 * 支持的 provider：https://docs.astro.build/en/reference/font-provider-reference/#built-in-providers
 *   "google"     - Google Fonts
 *   "fontsource" - Fontsource（构建时从 cdn.jsdelivr.net 拉取，需要外网）
 *   "local"      - 本地字体文件（含 node_modules 内的 @fontsource 包，完全离线）
 *   "bunny"      - Bunny Fonts
 *   "fontshare"  - Fontshare
 *   "npm"        - NPM 包（如 @fontsource/*）
 *
 * 注意：内置的 "fontsource" / "npm" provider 都会把字体 URL 重写到
 * cdn.jsdelivr.net（unifont 的 DEFAULT_CDN 硬编码），国内网络下构建会失败。
 * 因此本站内置字体统一走 "local" provider + @fontsource/* 依赖，构建过程不访问任何 CDN。
 *
 * 本地字体子集化：在 fontConfig.subsetFonts 中添加对应 cssVariable 的配置，
 * 构建时脚本会自动扫描页面字符并生成轻量 woff2 子集。
 */
import type { FontDefinition, FontSelectionConfig } from "@/types/fontConfig";

// ─── @fontsource 变体生成 ───────────────────────────────────
// @fontsource 静态包中每个「字重 × 子集」都是一个独立 woff2，
// 命名规则：<pkg>/files/<pkg>-<subset>-<weight>-normal.woff2
//
// 必须显式声明 unicodeRange：不同子集的 @font-face 描述符完全相同，
// 浏览器只会使用最后一条，导致另一子集的字符回退到系统字体。

/** 基本拉丁字符集（对应 fontsource 的 latin 子集） */
const UNICODE_RANGE_LATIN =
	"U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD".split(
		",",
	) as [string, ...string[]];

/** 西里尔字符集（对应 fontsource 的 cyrillic 子集） */
const UNICODE_RANGE_CYRILLIC =
	"U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116".split(",") as [
		string,
		...string[],
	];

type FontVariant = NonNullable<
	NonNullable<FontDefinition["options"]>["variants"]
>[number];

/**
 * 按 @fontsource 命名规则生成 latin + cyrillic 变体列表。
 *
 * @param pkg     @fontsource 下的包名后缀，如 "inter"（需先 `pnpm add @fontsource/inter`）
 * @param weights 该包实际提供的字重，文件不存在会导致构建失败
 */
function fontsourceVariants(pkg: string, weights: string[]): FontVariant[] {
	return weights.flatMap((weight) => [
		{
			src: [`@fontsource/${pkg}/files/${pkg}-latin-${weight}-normal.woff2`],
			weight,
			style: "normal",
			unicodeRange: UNICODE_RANGE_LATIN,
		},
		{
			src: [`@fontsource/${pkg}/files/${pkg}-cyrillic-${weight}-normal.woff2`],
			weight,
			style: "normal",
			unicodeRange: UNICODE_RANGE_CYRILLIC,
		},
	]);
}

// ─── Astro Font API 字体定义 ───────────────────────────────
// 适用于 Astro Font API 的字体配置，支持自动下载、缓存和优化加载
// 本地开发调试的情况下，修改后需要每次重启开发服务器才能生效
export const fontsList: FontDefinition[] = [
	{
		name: "Zen Maru Gothic",
		cssVariable: "--font-zen-maru-gothic",
		provider: "local",
		// Zen Maru Gothic 上游没有 600 字重（仅 300/400/500/700/900）
		options: {
			variants: fontsourceVariants("zen-maru-gothic", [
				"300",
				"400",
				"500",
				"700",
			]),
		},
		fallbacks: ["sans-serif"],
	},
	{
		name: "Inter",
		cssVariable: "--font-inter",
		provider: "local",
		options: {
			variants: fontsourceVariants("inter", [
				"300",
				"400",
				"500",
				"600",
				"700",
			]),
		},
		fallbacks: ["sans-serif"],
	},
	{
		name: "JetBrains Mono",
		cssVariable: "--font-jetbrains-mono",
		provider: "local",
		options: {
			variants: fontsourceVariants("jetbrains-mono", ["400", "700"]),
		},
		fallbacks: [
			"ui-monospace",
			"SFMono-Regular",
			"Menlo",
			"Monaco",
			"Consolas",
			"Liberation Mono",
			"Courier New",
			"monospace",
		],
	},
	// ─── 本地字体示例 ───
	// 使用步骤：
	// 1. 将 TTF/OTF/WOFF2 字体文件放在 public/assets/fonts/ 目录下
	// 2. 参考下方配置填写正确的字体信息
	// 3. 在 fontConfig.selected 或区域字段中引用 cssVariable
	{
		// 霞鹜文楷 Lite（字体内部族名，CSS 里就是这个名字）
		// 只有 Regular 一个字形，500 以上字重由浏览器合成加粗
		name: "LXGW WenKai Lite",
		cssVariable: "--font-lxgw-wenkai",
		provider: "local",
		display: "swap",
		options: {
			variants: [
				{
					src: ["./public/assets/fonts/LXGW-WenKai-Lite-Regular.ttf"],
					weight: "400",
					style: "normal",
				},
			],
		},
		fallbacks: ["sans-serif"],
	},
	{
		name: "GreatVibes Regular 2",
		cssVariable: "--font-greatvibes",
		provider: "local",
		options: {
			variants: [
				{
					src: ["./public/assets/fonts/GreatVibes-Regular-2.otf"],
				},
			],
		},
		fallbacks: ["sans-serif"],
	},
];

// ─── 字体选择与区域覆盖 ─────────────────────────────────────
export const fontConfig: FontSelectionConfig = {
	// 是否启用自定义字体功能
	enable: true,
	// 当前选择的字体 CSS 变量名（对应上方 fonts 中的 cssVariable）
	// 使用 "system" 表示系统字体（不加载任何自定义字体）
	selected: ["--font-lxgw-wenkai"],

	// 各区域独立字体设置（填写上方 fonts 中的 cssVariable，留空则使用全局 selected 字体）
	// 例如：bannerTitleFont: "--font-inter", 表示主页横幅主标题使用 Inter 字体
	// 主页横幅主标题字体
	bannerTitleFont: "",
	// 主页横幅副标题字体
	bannerSubtitleFont: "",
	// 导航栏标题字体
	navbarTitleFont: "",
	// 代码块字体（用于代码高亮和等宽字体场景）
	codeFont: "--font-jetbrains-mono",

	// 本地字体子集化配置（构建时由 scripts/subset-fonts.ts 处理）
	// key 为 fonts 数组中对应的 cssVariable，value 为子集化选项
	subsetFonts: {
		// 霞鹜文楷是完整 CJK 字体（约 2MB），构建时按页面实际用到的字生成 woff2 子集
		// extraChars 用来兜底动态内容（评论区、番组、随机文案等页面里扫不到的字符）
		"--font-lxgw-wenkai": {
			extraChars:
				"的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取据处队南给色光门即保治北造百规热领七海口东导器压志世金增争济阶油思术极交受联什认六共权收证改清己美再采转更单风切打白教速花带安场身车例真务具万每目至达走积示议声报斗完类八离华名确才科张信马节话米整空元况今集温传土许步群广石记需段研界拉林律叫且究观越织装影算低持音众书布复容儿须际商非验连断深难近矿千周委素技备半办青省列习响约支般史感劳便团往酸历市克何除消构府称太准精值号率族维划选标写存候毛亲快效斯院查江型眼王按格养易置派层片始却专状育厂京识适属圆包火住调满县局照参红细引听该铁价严",
		},
		"--font-greatvibes": {
			// 额外包含的字符
			extraChars: "",
		},
	},
};
