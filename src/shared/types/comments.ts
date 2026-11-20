/**
 * 评论接口配置：对接自建后端（`/api/v1/posts/{slug}/comments`）。
 *
 * 和 `siteStatsConfig` 指向同一个服务，但刻意分成两份配置：
 * 关掉访问统计不该连带把评论一起关掉，两者的开关语义不同。
 */
export type CommentApiConfig = {
	/**
	 * 是否启用自建评论接口。
	 *
	 * 关掉之后：动态卡片与侧栏的数字退回数据源里的值，抽屉不再发请求，
	 * 消息区显示空态、输入栏收起 —— 不会显示「加载失败」，那会让人以为
	 * 服务出故障，而实际上是这里主动关的。
	 */
	enable: boolean;
	/** 后端 API 基地址，末尾不要带斜杠；部署后改成公网地址 */
	apiBaseUrl: string;
	/**
	 * 一次拉多少条评论（也是「加载更早」每页的量）。
	 * 后端另有 100 的硬上限，超出的值会被截断。
	 */
	pageSize: number;
	/** 请求超时（毫秒）。失败时聊天区显示空态，不阻塞页面 */
	requestTimeoutMs: number;
};

/**
 * 表情包配置
 * ---------------------------------------------------------------------------
 * 数据由桌面端 EmojiJsonEditor 生成，一份 JSON = 一个表情包系列 = 面板里的一个 tab。
 * JSON 和图片放在同一个目录（public/emoji/<系列>.json 挨着 <系列>/ 图片文件夹），
 * JSON 里只存「基础地址 + 文件名」，完整路径在读的时候拼出来；
 * config/commentEmojiConfig.ts 再把它摊平成组件直接能用的结构。
 */

/** JSON 里的一条记录：id / 标题 / 文件名 */
export interface CommentEmojiFile {
	/** 纯数字 id，只作标识，不参与 URL */
	id: string;
	/** 标题：面板按钮的 title 与 aria-label */
	title: string;
	/** 文件名，拼在 basePath 后面才是完整地址 */
	"file-name": string;
}

/** JSON 的完整结构（编辑器的输出格式） */
export interface CommentEmojiSource {
	/** 系列名，同时也是 public 下的目录名 */
	category: string;
	/** 基础地址，以 / 结尾；读取时和文件名拼接 */
	basePath: string;
	/** 素材的意图尺寸（px），行内表情的边长取它 */
	defaultSize: { width: number; height: number };
	data: CommentEmojiFile[];
}

/** 归一化后的单个表情：src 已经拼好 */
export interface CommentEmojiItem {
	/** 唯一 id：只作标识与将来的「最近使用」排序，不参与 URL */
	id: string;
	/** 无障碍名称，写在按钮的 title / aria-label 上 */
	name: string;
	/** 图片地址：basePath + file-name，例如 /emoji/huoying/hy-1.webp */
	src: string;
}

/** 面板里的一栏 */
export interface CommentEmojiPack {
	/** 系列名，用作 tab / 网格的 id */
	id: string;
	/** tab 上的提示文字 */
	label: string;
	/** 行内表情边长（px），来自 JSON 的 defaultSize.width */
	size: number;
	items: CommentEmojiItem[];
}

export interface CommentEmojiConfig {
	/** 行内表情的边长（px）：输入框里和气泡里共用，24 = 24×24；
	    面板里的格子跟随 emoji 网格，不受这个值影响 */
	size: number;
	packs: CommentEmojiPack[];
}

/** 评论区壁纸（动态页评论抽屉里铺满聊天区的那张 Lottie 动画） */

export interface CommentWallpaperItem {
	/** 稳定标识，会写进 localStorage；改掉等于丢掉已有访客的选择 */
	id: string;
	/** 设置面板里显示的名字 */
	name: string;
	/** Lottie JSON 地址，相对站点根目录（放在 public 下，不要写 BASE_URL） */
	src: string;
	/**
	 * 色板。第一个是主色，兼作「壁纸画出来之前的垫底色」——挑最接近成品整体明度的那个，
	 * 太深会让打开抽屉时先暗一下；其余只用于设置面板上的缩略色块。
	 */
	colors: string[];
}

export interface CommentWallpaperConfig {
	/** 是否允许在「设置 → 壁纸」里切换；关掉后固定使用默认那张 */
	switchable: boolean;
	/** 默认壁纸 id，也是「恢复默认」的目标 */
	defaultId: string;
	/** 可选项，至少一张 */
	wallpapers: CommentWallpaperItem[];
}
