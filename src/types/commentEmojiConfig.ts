/**
 * 表情包配置
 * ---------------------------------------------------------------------------
 * 数据由桌面端 EmojiJsonEditor 生成，一份 JSON = 一个表情包系列 = 面板里的一个 tab。
 * JSON 和图片放在同一个目录（public/assets/emoji/<系列>.json 挨着 <系列>/ 图片文件夹），
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
	/** 图片地址：basePath + file-name，例如 /assets/emoji/huoying/hy-1.webp */
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
