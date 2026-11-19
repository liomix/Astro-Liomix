// 显示设置面板的开关配置（跨域：布局、横幅、主题面板都读它）。
// 环境变量 PUBLIC_DISPLAY_SETTINGS 优先于这里的字面值。

import type { DisplaySettingsConfig } from "@/shared/types/displaySettings";

// 视图设置面板总开关的解析工具
// 把「环境变量覆盖」和「总开关关闭时强制关闭所有子项」的逻辑收敛在这里，
// 让 displaySettingsConfig.ts 保持纯配置，不掺杂判断代码

const TRUTHY_VALUES = ["true", "1", "on", "yes", "enable", "enabled"];
const FALSY_VALUES = ["false", "0", "off", "no", "disable", "disabled"];

// 解析布尔类型的环境变量，返回 undefined 表示未设置或取值无法识别
function parseBooleanEnv(raw: unknown): boolean | undefined {
	if (typeof raw !== "string") return undefined;
	const value = raw.trim().toLowerCase();
	if (TRUTHY_VALUES.includes(value)) return true;
	if (FALSY_VALUES.includes(value)) return false;
	return undefined;
}

// 总开关关闭时的配置：所有设置项强制关闭
// 导航栏入口与设置面板都不渲染，壁纸模式等运行时逻辑直接使用配置的默认值
const DISABLED_SETTINGS: DisplaySettingsConfig = {
	enable: false,
	themeColorSwitchable: false,
	layoutSwitchable: false,
	cardBorderSwitchable: false,
	cardFollowThemeSwitchable: false,
	wallpaperModeSwitchable: false,
	fullscreenLayoutSwitchable: false,
	wavesSwitchable: false,
	gradientSwitchable: false,
	bannerTitleSwitchable: false,
	bannerCarouselSwitchable: false,
	overlaySwitchable: false,
	sakuraSwitchable: false,
};

// 读取总开关环境变量
// 页面与浏览器端代码走 Vite/Astro，import.meta.env 会被静态替换成具体值；
// 构建脚本（scripts/*.ts 用 tsx 在 Node 里跑）没有 import.meta.env，回退读 process.env
function readEnableEnv(): unknown {
	try {
		return import.meta.env.PUBLIC_DISPLAY_SETTINGS;
	} catch {
		return typeof process === "undefined"
			? undefined
			: process.env.PUBLIC_DISPLAY_SETTINGS;
	}
}

// 应用总开关：环境变量 PUBLIC_DISPLAY_SETTINGS 优先于配置文件里的 enable
// 这样在部署平台（Vercel / Cloudflare 等）配置环境变量即可开启面板，无需修改配置文件
// 变量名必须带 PUBLIC_ 前缀，否则不会注入到浏览器端的设置面板代码中
export function resolveDisplaySettingsConfig(
	config: DisplaySettingsConfig,
): DisplaySettingsConfig {
	const enable = parseBooleanEnv(readEnableEnv()) ?? config.enable;
	return enable ? { ...config, enable: true } : DISABLED_SETTINGS;
}

// 显示设置面板开关配置
// 集中管理设置面板中所有可切换项的开关
// 方便统一控制哪些设置项对用户可见
// 也方便进行调试预览效果

export const displaySettingsConfig: DisplaySettingsConfig =
	resolveDisplaySettingsConfig({
		// ── 总开关 (Master switch) ────────────────────────────

		// 视图设置面板总开关，关闭时下方所有设置项均不生效，前台将不显示设置面板
		// 开启后设置面板组件及其依赖（各设置项逻辑、图标等）会打进客户端产物，
		// 会导致构建体积变大、首屏多一份 JS 影响性能；关闭则完全不渲染面板，体积更小，
		// 壁纸模式切换开关，这一项是构建体积的大头
		// 壁纸模式切换开关设为 false 则不显示壁纸模式切换开关，始终使用 backgroundWallpaperConfig 配置的默认壁纸模式
		// 壁纸模式切换开关设为 true 时，为了能在运行时切换，构建期必须把各壁纸模式所需的整套内容，导致构建体积大幅增加，大概+33 KB/页，首屏加载时间变长，性能下降

		// 除了改这里，也可以在部署平台（Vercel / Cloudflare 等）配置环境变量开启，
		// 无需改动本文件：PUBLIC_DISPLAY_SETTINGS=true
		// 环境变量优先级更高，未设置或取值无法识别时使用这里的值
		// 生产环境建议默认关闭，只在开发调试环境开启用来预览效果
		// 当前开启：右下角调色板悬浮按钮与导航栏调色板按钮都依赖它，关闭后按钮不会渲染
		enable: true,

		// ── 外观 (Appearance) ──────────────────────────────────

		// 主题色选择器开关
		themeColorSwitchable: true,

		// 文章列表布局切换开关
		layoutSwitchable: true,

		// 卡片边框和阴影开关
		cardBorderSwitchable: true,

		// 卡片风格跟随主题色开关
		cardFollowThemeSwitchable: true,

		// ── 壁纸 (Wallpaper) ──────────────────────────────────

		// 壁纸模式切换开关
		wallpaperModeSwitchable: true,

		// 全屏壁纸布局切换开关（classic / hero）
		fullscreenLayoutSwitchable: true,

		// 水波纹动画开关
		wavesSwitchable: true,

		// 渐变过渡效果开关
		gradientSwitchable: true,

		// 横幅标题显示开关
		bannerTitleSwitchable: true,

		// 壁纸轮播开关
		bannerCarouselSwitchable: true,

		// 全屏壁纸/透明覆盖模式参数调节开关
		// 设为 false 关闭所有滑块，或用对象形式单独控制每个滑块
		overlaySwitchable: {
			opacity: true,
			transparency: true,
			cardOpacity: true,
			panelTransparency: true,
		},

		// ── 特效 (Effects) ────────────────────────────────────

		// 樱花特效开关
		sakuraSwitchable: true,
	});
