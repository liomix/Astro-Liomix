/**
 * 访客定位接口配置：对接自建后端（`/api/v1/location/me`）。
 *
 * 定位从「浏览器直接问第三方（ipwho.is / ipapi.is）」换成了走自己的后端：
 * 高德 Key 与数字签名私钥都在服务端环境变量里，浏览器拿不到也改不了；
 * 失败频率与缓存节奏也由服务端统一控制，不再每台浏览器各问各的。
 */
export type LocationApiConfig = {
	/**
	 * 是否启用定位卡片。
	 *
	 * 后端没配 AMAP_KEY 时这个接口本来就不存在，失败是常态而不是故障；
	 * 这里关掉等于直接不请求、不显示，也不留任何日志噪音。
	 */
	enable: boolean;
	/** 后端 API 基地址，末尾不要带斜杠；部署后改成公网地址 */
	apiBaseUrl: string;
	/** 请求超时（毫秒）。失败时欢迎卡片整体隐藏，不阻塞侧栏 */
	requestTimeoutMs: number;
};
