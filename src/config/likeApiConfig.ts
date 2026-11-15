import type { LikeApiConfig } from "../types/likeApiConfig";

export const likeApiConfig: LikeApiConfig = {
	// 是否启用服务端点赞
	enable: true,
	// 自建评论/统计后端地址，与 commentApiConfig 指向同一台服务
	apiBaseUrl: "http://localhost:8080",
	// 一次点赞/取消最多等多久
	requestTimeoutMs: 8000,
};
