import type { LocationApiConfig } from "../types/locationApiConfig";

export const locationApiConfig: LocationApiConfig = {
	// 是否启用访客定位卡片
	enable: true,
	// 自建后端地址，与 commentApiConfig / likeApiConfig 指向同一台服务
	apiBaseUrl: "http://localhost:8080",
	// 一次定位最多等多久
	requestTimeoutMs: 8000,
};
