export type WelcomeConfig = {
	enable: boolean; // 是否启用访客欢迎信息
	// 站长所在位置，用于计算访客与站长的直线距离
	siteLocation: {
		label?: string; // 备注用，不参与渲染
		latitude: number;
		longitude: number;
	};
	showIp: boolean; // 是否显示访客 IP
	showDistance: boolean; // 是否显示与站长的距离
	cacheHours: number; // 定位结果本地缓存时长（小时），用于减少第三方 API 调用
	// 欢迎动画（Lottie JSON）路径，相对 public 目录；留空则使用默认动画
	lottieSrc?: string;
};
