import type { CommentApiConfig } from "../types/commentApiConfig";

export const commentApiConfig: CommentApiConfig = {
	// 是否启用自建评论接口（动态页评论区）
	enable: true,
	// 自建评论后端地址（末尾不要带斜杠）。本地开发指向 Go 服务，部署后改成公网地址
	apiBaseUrl: "http://localhost:8080",
	// 一次拉多少条评论
	pageSize: 50,
	// 请求超时（毫秒）。超时或后端不可用时聊天气泡区显示空态
	requestTimeoutMs: 8000,
};
