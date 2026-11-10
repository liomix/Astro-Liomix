import type { ProfileConfig } from "../types/profileConfig";

export const profileConfig: ProfileConfig = {
	// 头像
	// 图片路径支持三种格式：
	// 1. public 目录（以 "/" 开头，不优化）："/assets/images/avatar.webp"
	// 2. src 目录（不以 "/" 开头，自动优化但会增加构建时间，推荐）："assets/images/avatar.webp"
	// 3. 远程 URL："https://example.com/avatar.jpg"
	//
	// 支持的格式：
	// - 静态图：png / jpg / webp / avif（走图片优化，按需生成响应式尺寸）
	// - 动图：gif / apng / 动态 webp、avif（自动识别，跳过优化直出原图保留动画）
	// - 视频：mp4 / webm / mov / m4v（自动识别，渲染为静音循环播放）
	// 视频或大体积动图建议先转码压缩：
	//   pnpm avatar:convert <视频> --out src/assets/images/avatar-motion.mp4 --size 256 --fps 15 --format mp4
	avatar: "assets/images/avatar-motion.mp4",
	// 视频头像封面（首帧）：首帧渲染与 OG 图使用，静态头像时忽略
	avatarPoster: "assets/images/avatar-motion-poster.webp",
	// 静态头像备选：assets/images/avatar.avif

	// 头像形状：rect 圆角矩形（主题默认样式，铺满卡片宽度），circle 正圆（居中显示）
	avatarShape: "circle",

	// 头像右下角状态徽章：默认只露一个图标，鼠标悬浮时「图标不动，文字向右展开」
	// 目前默认关闭，要用时把 enable 改回 true 即可（下面的文字/图标/颜色都保留着）
	status: {
		// 总开关：false 直接不渲染，不用删代码
		enable: false,
		// 状态文字（悬浮后从图标右侧展开）；留空则只显示图标
		text: "Cold",
		// 状态图标，图标代码见 https://icones.js.org/；留空则显示成一个圆点
		icon: "material-symbols:ac-unit",
		// 图标 / 圆点颜色，留空则跟随主题色
		color: "#3b82f6",
	},

	// 头像动态策略：只决定「怎么识别头像」，不是播放开关（能不能播由文件本身决定）。
	//   "auto"   自动识别：读文件头（gif、apng、动态 webp/avif）+ 扩展名（mp4、webm、mov、m4v）
	//   "always" 始终当动态资源：跳过识别直出原文件（远程动态 WebP/AVIF 读不到文件头，必须用它）
	//   "never"  始终当静态图：只取第一帧、走图片优化
	// 本地头像用 auto 就能认出动图/视频；只有远程动态图才需要改成 "always"。
	avatarMotion: "auto",

	// 是否在卡片底部显示「文章 / 标签 / 分类」三列统计
	showStats: true,

	// 名字
	name: "liomix",

	// 个人签名
	bio: "Binary ghosts of illusion and shadow",

	// 链接配置
	// 已经预装的图标集：fa7-brands，fa7-regular，fa7-solid，material-symbols，simple-icons
	// 访问https://icones.js.org/ 获取图标代码，
	// 如果想使用尚未包含相应的图标集，则需要安装它
	// `pnpm add @iconify-json/<icon-set-name>`
	// showName: true 时显示图标和名称，false 时只显示图标
	links: [
		{
			name: "Discord",
			icon: "fa7-brands:discord",
			url: "https://discord.com/",
			showName: false,
		},
		{
			name: "Instagram",
			icon: "fa7-brands:instagram",
			url: "https://www.instagram.com/",
			showName: false,
		},
		{
			name: "Tiktok",
			icon: "fa7-brands:tiktok",
			url: "https://www.tiktok.com/",
			showName: false,
		},
		{
			// mailto: 开头的链接会自动走 base64 防爬处理（见 Profile.astro）
			name: "Email",
			icon: "fa7-solid:envelope",
			url: "mailto:xiaye@msn.com",
			showName: false,
		},
	],
};
