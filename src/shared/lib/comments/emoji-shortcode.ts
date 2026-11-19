import { commentEmojiConfig } from "@/shared/lib/comments/config";

/**
 * 行内表情的短码
 * ---------------------------------------------------------------------------
 * 评论正文里存的是 `:huoying/hy-1:`，不是一段 `<img class="tg-emoji-inline" …>`。
 *
 * 为什么不能存标签：
 *   - 正文是**内容**，标签是**表现**。目录改名、换 CDN、换一版素材，已发表的评论
 *     会全部变成破图，因为它们把当时的 URL 焊死在了文字里。
 *   - 字数上限按正文算。一条 `hy-1` 的 img 标签 77 个字符，短码 15 个，
 *     2000 字的上限里本来能放 130 个表情，存标签只能放 25 个。
 *   - 存了标签就等于承诺「这个字段里的 HTML 是可信的」，而它来自用户输入。
 *     渲染端一旦漏一道净化，评论就是存储型 XSS。
 *
 * 短码只在渲染时翻译成 `<img>`（见 Comment 的 marked 扩展），
 * 反向解析（渲染结果 → 短码）只发生在输入框读回时。
 */

/** 短码的形状：`:<系列>/<文件名主干>:`，系列与文件名都来自配置，不接受任意内容 */
const TOKEN_SHAPE = /^:([a-z0-9][a-z0-9_-]*)\/([a-z0-9][a-z0-9._-]*):$/i;

/** 渲染时用的扫描式正则。每次调用都新建：带 g 的 RegExp 有 lastIndex 状态 */
export function emojiTokenPattern(): RegExp {
	return /:([a-z0-9][a-z0-9_-]*)\/([a-z0-9][a-z0-9._-]*):/gi;
}

export interface ResolvedEmoji {
	/** 图片地址，来自配置而不是正文 */
	src: string;
	/** 无障碍名称，同时用于纯文本降级（复制、引用摘要） */
	alt: string;
}

/** 扩展产出的 token 形状（marked 只关心这几个字段） */
interface EmojiShortcodeToken {
	type: "emojiShortcode";
	raw: string;
	emoji: ResolvedEmoji;
}

/** marked 的 inline 扩展形状：只声明用到的三个方法 */
export interface MarkedEmojiExtension {
	name: string;
	level: "inline";
	start(src: string): number | undefined;
	tokenizer(src: string): EmojiShortcodeToken | undefined;
	renderer(token: EmojiShortcodeToken): string;
}

const byToken = new Map<string, ResolvedEmoji>();
const tokenBySrc = new Map<string, string>();

/** 去掉目录与扩展名：`/assets/emoji/huoying/hy-1.webp` → `hy-1` */
function stemOf(src: string): string {
	const file = src.slice(src.lastIndexOf("/") + 1);
	const dot = file.lastIndexOf(".");
	return dot > 0 ? file.slice(0, dot) : file;
}

for (const pack of commentEmojiConfig.packs) {
	for (const item of pack.items) {
		const token = `:${pack.id}/${stemOf(item.src)}:`.toLowerCase();
		byToken.set(token, { src: item.src, alt: item.name });
		tokenBySrc.set(item.src, token);
	}
}

/** 按图片地址反查短码，输入框里的老图片（没有记短码）走这条路 */
export function emojiTokenOfSrc(src: string): string | null {
	if (!src) return null;
	// 浏览器会把 src 补成绝对地址，配置里存的是站内路径。绝对地址自己就能解析出
	// pathname，不需要 location —— 这个模块也会被 Node 里的用例直接调用
	const path = /^https?:\/\//i.test(src) ? new URL(src).pathname : src;
	return tokenBySrc.get(path) ?? null;
}

/** 短码 → 表情。不认识的短码返回 null，由调用方决定当普通文字处理 */
export function resolveEmojiToken(token: string): ResolvedEmoji | null {
	if (!TOKEN_SHAPE.test(token)) return null;
	return byToken.get(token.toLowerCase()) ?? null;
}

/**
 * 纯文本降级：`[摸头]`。
 *
 * 复制到剪贴板、引用摘要这类只放得下文字的地方用它。留着短码也不是不行，
 * 但 `:huoying/hy-1:` 对读的人是噪音，而 alt 正是当初给这个表情起的名字。
 * 不认识的短码原样留下：那是用户自己写的字，不该被吞掉。
 */
export function emojiTokensToText(text: string): string {
	return text.replace(
		emojiTokenPattern(),
		(raw, pack: string, name: string) => {
			const emoji = resolveEmojiToken(`:${pack}/${name}:`);
			return emoji ? `[${emoji.alt}]` : raw;
		},
	);
}

/**
 * 短码 → `<img>`，给「要看见表情、但只有一行高度」的地方用。
 *
 * 引用块和回复条都属于这种：把 `[摸头]` 这样的文字塞进去，读的人得自己脑补；
 * 直接给图，但**小一号**（尺寸由 CSS 的 `.tg-quote-text img` 控制）。
 *
 * 与 marked 扩展的区别：那个只作用在正文的文本 token 上，代码块天然碰不到；
 * 这里是纯字符串替换，调用方必须保证入参来自评论正文而不是代码片段。
 * 文本部分一律转义 —— 这段 HTML 会被 innerHTML 直接塞进 DOM。
 */
export function emojiTokensToHtml(
	text: string,
	className = "tg-emoji-inline",
): string {
	// 没有冒号就没有短码，整段按纯文本转义即可，省掉一次正则
	if (!text.includes(":")) return escapeHtml(text);

	let result = "";
	let last = 0;
	for (const match of text.matchAll(emojiTokenPattern())) {
		const index = match.index ?? 0;
		const emoji = resolveEmojiToken(match[0]);
		if (!emoji) continue;
		result += escapeHtml(text.slice(last, index));
		result += `<img class="${escapeAttr(className)}" src="${escapeAttr(emoji.src)}" alt="${escapeAttr(emoji.alt)}" title="${escapeAttr(emoji.alt)}" loading="lazy" decoding="async">`;
		last = index + match[0].length;
	}
	result += escapeHtml(text.slice(last));
	return result;
}

/** 纯文本转义：短码替换出来的是 HTML，文字部分必须先转义 */
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/** 属性值转义：渲染器产出的 HTML 不设例外，配置里多一个引号也不能变成注入 */
function escapeAttr(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/**
 * 给 marked 用的行内扩展：短码 → `<img>`。
 *
 * 为什么是扩展而不是「渲染前先全文替换」：替换是纯字符串操作，代码块里写到的
 * 短码也会被翻译成图片。扩展只作用在正文文本 token 上，代码块是另一类 token，
 * 天然碰不到；行内代码同理（见 emoji-shortcode 的用例）。
 *
 * 认不出的短码返回 undefined，让它留作普通文字 —— 用户写的 `:a/b:` 不能被吞。
 */
export const emojiShortcodeExtension: MarkedEmojiExtension = {
	name: "emojiShortcode",
	level: "inline",
	start(src: string) {
		return src.indexOf(":");
	},
	tokenizer(src: string) {
		const match = /^:([a-z0-9][a-z0-9_-]*)\/([a-z0-9][a-z0-9._-]*):/i.exec(src);
		if (!match) return undefined;
		const emoji = resolveEmojiToken(match[0]);
		if (!emoji) return undefined;
		return { type: "emojiShortcode", raw: match[0], emoji };
	},
	renderer(token: EmojiShortcodeToken) {
		return `<img class="tg-emoji-inline" src="${escapeAttr(token.emoji.src)}" alt="${escapeAttr(token.emoji.alt)}">`;
	},
};
