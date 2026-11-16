import type { WelcomeConfig } from "../types/welcomeConfig";

export const welcomeConfig: WelcomeConfig = {
	// 是否在公告卡片中显示访客欢迎信息
	enable: true,

	// 站长所在位置，用于计算「你目前距站长约 xx 公里」。
	// 用真实位置而不是市中心：距离是拿它当终点算的，差几十公里会让站长自己
	// 在家里也显示成「距站长约 60 公里」。后端 SITE_LOCATION_LAT/LNG 要保持一致。
	siteLocation: {
		label: "桂林市",
		latitude: 25.465705,
		longitude: 110.390477,
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
