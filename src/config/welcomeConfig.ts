import type { WelcomeConfig } from "../types/welcomeConfig";

export const welcomeConfig: WelcomeConfig = {
	// 是否在公告卡片中显示访客欢迎信息
	enable: true,

	// 站长所在位置（默认广州），用于计算「你目前距站长约 xx 公里」
	siteLocation: {
		label: "广州市",
		latitude: 23.1291,
		longitude: 113.2644,
	},

	// 是否显示访客 IP（默认不显示）
	showIp: false,

	// 是否显示与站长的距离
	showDistance: true,

	// 定位结果缓存时长（小时），避免每次刷新都请求第三方接口
	cacheHours: 12,

	// 欢迎动画（Lottie JSON），放在 public/lottie 下，换动画只需替换文件或改这里
	lottieSrc: "/lottie/welcome.json",
};
