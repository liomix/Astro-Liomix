import type { MusicPlayerConfig } from "../types/musicConfig";

// 音乐播放器配置
export const musicPlayerConfig: MusicPlayerConfig = {
	// 是否在导航栏显示音乐入口（搜索图标右侧）
	// 点击只切换播放/暂停，图标随播放状态变成跳动的均衡器
	showInNavbar: true,

	// 是否在侧边栏显示音乐播放器组件
	showInSidebar: true,

	// 使用方式："meting" 使用 Meting API，"local" 使用本地音乐列表
	mode: "local",

	// 默认音量 (0-1)
	volume: 0.7,

	// 播放模式：'list'=列表循环, 'one'=单曲循环, 'random'=随机播放
	playMode: "list",

	// 进入站点是否自动播放
	// 这只是默认值：「设置 → 播放设置 → 进入站点自动播放」里的开关会覆盖它
	// 浏览器通常拦截带声音的自动播放，被拦截时会等用户第一次点击/按键后再播
	autoPlay: false,

	// 是否显启用歌词
	showLyrics: false,

	// Meting API 配置
	meting: {
		// Meting API 地址
		// 默认使用官方 API，也可以使用自定义 API
		api: "https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",
		// 音乐平台：netease=网易云音乐, tencent=QQ音乐, kugou=酷狗音乐, xiami=虾米音乐, baidu=百度音乐
		server: "netease",
		// 类型：song=单曲, playlist=歌单, album=专辑, search=搜索, artist=艺术家
		type: "playlist",
		// 歌单/专辑/单曲 ID 或搜索关键词
		id: "10046455237",
		// 认证 token（可选）
		auth: "",
		// 备用 API 配置（当主 API 失败时使用）
		fallbackApis: [
			"https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
			"https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id",
		],
	},

	// 缺省封面：曲目没写 cover、或音频里没有内嵌封面时用它
	// 放在 public 下，路径相对站点根目录
	defaultCover: "/assets/music/cover/default.svg",

	// 本地音乐配置（当 mode 为 'local' 时使用）
	// 1. 支持传入歌词文件的路径
	// lrc: "/assets/music/lrc/直到你降临.lrc",
	// 2. 或者直接填入歌词字符串内容
	// lrc: "[00:00.00]歌词内容...",
	local: {
		playlist: [
			{
				name: "直到你降临",
				artist: "阿肆",
				// 从「直到你降临.mp4」无损提取的音轨（AAC 原样搬运，未二次压缩）
				url: "/assets/music/直到你降临.m4a",
				// 不写 cover：音频本身没有内嵌封面，走上面的 defaultCover
				lrc: "",
			},
		],
	},
};
