import huoying from "../../public/assets/emoji/huoying.json";
import type {
	CommentEmojiConfig,
	CommentEmojiPack,
	CommentEmojiSource,
} from "../types/commentEmojiConfig";

/**
 * 评论区表情包
 * ---------------------------------------------------------------------------
 * 一份 JSON = 一个系列 = 面板里的一个 tab。JSON 由桌面端 EmojiJsonEditor 生成，
 * 和图片一起放在 public/assets/emoji/ 下（<系列>.json 挨着 <系列>/ 图片文件夹），
 * 编辑器填的「基础地址」就是图片目录在站点里的路径。
 *
 * 加一个新系列：
 *   1. 图片丢进 public/assets/emoji/<系列>/；
 *   2. 用编辑器导出 <系列>.json，放到 public/assets/emoji/ 下；
 *   3. 在下面 packs 里加一行 packOf(...)，标签写中文名。
 * 组件不用改：tab 按 packs 生成，只有一个系列时不显示 tab 栏。
 *
 * 面板格子完全跟随 emoji：同一套 8 列网格、同一个 .tg-emoji-item 尺寸，
 * 图片按 contain 填满格子 —— 面板里多大不在这里配。
 *
 * size 只决定**输入框里和气泡里**那张的边长，取第一个系列的 defaultSize.width：
 * 24 和正文行高接近，表情混在文字里像大号 emoji，不会把行撑开。
 */
function packOf(source: CommentEmojiSource, label: string): CommentEmojiPack {
	// basePath 由编辑器保证以 / 结尾，这里再兜一次，省得漏了斜杠拼出 hy-1.webp 贴在包名后面
	const base = source.basePath.endsWith("/")
		? source.basePath
		: `${source.basePath}/`;
	return {
		id: source.category,
		label,
		size: source.defaultSize?.width || 24,
		items: source.data.map((entry) => ({
			id: entry.id,
			// 标题为空时退回文件名，至少按钮上有个能读的东西
			name: entry.title?.trim() || entry["file-name"],
			src: base + entry["file-name"],
		})),
	};
}

const packs: CommentEmojiPack[] = [
	packOf(huoying as CommentEmojiSource, "火影"),
];

export const commentEmojiConfig: CommentEmojiConfig = {
	size: packs[0]?.size ?? 24,
	packs,
};
