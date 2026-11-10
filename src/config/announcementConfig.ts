import type { AnnouncementConfig } from "../types/announcementConfig";

export const announcementConfig: AnnouncementConfig = {
	// 公告标题，留空则走i18n默认标题
	title: "",

	// 公告内容（显示在侧栏卡片里，点击后弹窗查看全文）
	content: "欢迎来到我的博客！这是一则示例公告。",

	// 弹窗中展示的完整公告：留空则与 content 相同；
	// 填写后卡片正文自动收成 3 行，点击弹出全文
	// fullContent: "第一段……\n\n第二段……",

	// 是否允许用户关闭公告（按钮已移除，保留字段以备恢复）
	closable: false,

	link: {
		// 文字区是否可点击（点击弹出公告全文弹窗）
		enable: true,
		// 链接文本（已不再显示，保留字段兼容旧配置）
		text: "了解更多",
		// 兜底链接：无 JS 或按住 Ctrl/中键点击时仍打开该地址
		url: "/",
		// 内部链接
		external: false,
	},
};
