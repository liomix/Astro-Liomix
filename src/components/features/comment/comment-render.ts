/**
 * 评论区的渲染层：时间格式、头像色调、Markdown → 消毒后的 HTML
 * ---------------------------------------------------------------------------
 * 从 Comment.astro 的 <script> 里抽出来。这些函数只依赖 DOM + marked，不认识评论接口，
 * 也不碰任何组件状态 —— 留在组件里只会让那个 1900 行的文件继续膨胀。
 *
 * 安全边界在这里：SAFE_TAGS / DROP_TAGS 决定「后端存下来的 HTML 能不能进气泡」，
 * 改白名单等于改评论的信任边界，别为了显示效果放宽它。
 */

import { Marked } from "marked";
import { createEmptyLottie } from "@/components/ui/empty-lottie";
import { emojiShortcodeExtension } from "@/utils/emoji-shortcode";

const pad = (value: number) => String(value).padStart(2, "0");

/** 本地时间 HH:mm：自己刚发的气泡和刷新后拉回来的走同一份格式 */
export const clockOf = (date: Date): string =>
	`${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** 时间戳是不是今天（本地时区）—— 决定时间要不要带日期 */
export function isToday(iso: string): boolean {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return false;
	const now = new Date();
	return (
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate()
	);
}

/**
 * 后端时间戳（RFC3339）→ 气泡右下角的时间。
 * 跨天时补上日期：评论可能躺了几天才被审核通过，只显示 HH:mm 会让人以为刚发的。
 */
export function formatTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	const clock = clockOf(date);
	return isToday(iso)
		? clock
		: `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clock}`;
}

/**
 * 按昵称挑一档头像色调（0–3）。
 * 后端只回昵称、没有 tone 字段，这里用稳定哈希：同一个名字永远同一种颜色，
 * 刷新和换设备都不会变，比按列表顺序分配更不容易让人认错人。
 */
export function toneOf(name: string): number {
	let hash = 0;
	for (const char of name) {
		hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
	}
	return hash % 4;
}

/* ---------------- Markdown ---------------- */

/** 只建一次实例：GFM（表格 / 删除线 / 自动链接）+ 单换行也算换行 */
const md = new Marked({ gfm: true, breaks: true });

// 行内表情：正文里存的是短码（`:huoying/hy-1:`），渲染时才翻译成图片。
// 做成扩展而不是先替换再解析，是为了让代码块和行内代码里的短码原样留着。
md.use({ extensions: [emojiShortcodeExtension] });

/** 语言标识 → 顶栏显示名；表里没有的原样显示，没写语言的用「代码」兜底 */
const LANG_NAMES: Record<string, string> = {
	js: "JavaScript",
	javascript: "JavaScript",
	ts: "TypeScript",
	typescript: "TypeScript",
	jsx: "JSX",
	tsx: "TSX",
	py: "Python",
	python: "Python",
	sh: "Shell",
	bash: "Bash",
	zsh: "Zsh",
	shell: "Shell",
	powershell: "PowerShell",
	ps1: "PowerShell",
	json: "JSON",
	jsonc: "JSON",
	html: "HTML",
	xml: "XML",
	svg: "SVG",
	css: "CSS",
	scss: "SCSS",
	less: "Less",
	md: "Markdown",
	markdown: "Markdown",
	yml: "YAML",
	yaml: "YAML",
	toml: "TOML",
	ini: "INI",
	sql: "SQL",
	go: "Go",
	golang: "Go",
	rust: "Rust",
	rs: "Rust",
	java: "Java",
	kt: "Kotlin",
	kotlin: "Kotlin",
	swift: "Swift",
	c: "C",
	cpp: "C++",
	cs: "C#",
	csharp: "C#",
	php: "PHP",
	rb: "Ruby",
	ruby: "Ruby",
	lua: "Lua",
	diff: "Diff",
	patch: "Diff",
	dockerfile: "Dockerfile",
	makefile: "Makefile",
	vue: "Vue",
	svelte: "Svelte",
	astro: "Astro",
	graphql: "GraphQL",
	gql: "GraphQL",
	text: "",
	plaintext: "",
};
/** 气泡里允许出现的标签，marked 的其余输出一律处理掉 */
const SAFE_TAGS = new Set([
	"P",
	"BR",
	"STRONG",
	"EM",
	"DEL",
	"CODE",
	"PRE",
	"A",
	"UL",
	"OL",
	"LI",
	"BLOCKQUOTE",
	"H1",
	"H2",
	"H3",
	"H4",
	"H5",
	"H6",
	"HR",
	"TABLE",
	"THEAD",
	"TBODY",
	"TR",
	"TH",
	"TD",
	"IMG",
]);

/** 这些标签连内容一起丢掉，不只是拆壳（否则脚本正文会当成文字留在气泡里） */
const DROP_TAGS = new Set([
	"SCRIPT",
	"STYLE",
	"IFRAME",
	"OBJECT",
	"EMBED",
	"FORM",
	"INPUT",
	"TEXTAREA",
	"SELECT",
	"BUTTON",
	"LINK",
	"META",
	"BASE",
	"SVG",
	"MATH",
]);

/** IMG 上唯一放行的 class：表情包要按行内小图排版，其余 class 一律丢掉 */
const IMG_CLASS_WHITELIST = new Set(["tg-emoji-inline"]);

/**
 * 用浏览器自己的解析器过一遍白名单，比正则可靠：
 * 先把 HTML 塞进 template（不执行、不加载资源），再逐个节点判断。
 * 不认识的标签拆壳保留文字；危险标签整段删除；属性只留必要的那几个。
 */
function sanitizeHtml(html: string): string {
	const template = document.createElement("template");
	template.innerHTML = html;

	const walk = (parent: Node) => {
		for (const child of Array.from(parent.childNodes)) {
			if (child.nodeType === Node.COMMENT_NODE) {
				child.remove();
				continue;
			}
			if (child.nodeType !== Node.ELEMENT_NODE) continue;

			const el = child as Element;
			const tag = el.tagName.toUpperCase();

			if (DROP_TAGS.has(tag)) {
				el.remove();
				continue;
			}

			// 先净化里面的内容，再把外壳拆掉（拆完文字直接挂在父节点上）
			walk(el);
			if (!SAFE_TAGS.has(tag)) {
				el.replaceWith(...Array.from(el.childNodes));
				continue;
			}

			for (const attr of Array.from(el.attributes)) {
				const name = attr.name.toLowerCase();
				const keep =
					(tag === "A" && (name === "href" || name === "title")) ||
					(tag === "IMG" &&
						(name === "src" || name === "alt" || name === "title")) ||
					(tag === "IMG" && name === "class") ||
					(tag === "CODE" && name === "class") ||
					(tag === "TH" && name === "align") ||
					(tag === "TD" && name === "align");
				if (!keep) el.removeAttribute(attr.name);
			}

			if (tag === "A") {
				const href = el.getAttribute("href") ?? "";
				// 只放行 http(s) / mailto / 站内锚点，javascript: 之类直接摘掉链接
				if (!/^(?:https?:|mailto:|#|\/)/i.test(href)) {
					el.removeAttribute("href");
				}
				el.setAttribute("target", "_blank");
				el.setAttribute("rel", "noopener noreferrer nofollow");
			}

			// 图片只认 http(s) 和站内地址；地址不合法就连图带标签一起删掉，
			// 不留一个破图占位。外链图不发送 Referer，也不阻塞首屏。
			if (tag === "IMG") {
				// class 只按白名单留 token，别的一律不要（这里只认表情包那一个）
				const tokens = (el.getAttribute("class") ?? "")
					.split(/\s+/)
					.filter((token) => IMG_CLASS_WHITELIST.has(token));
				if (tokens.length > 0) el.setAttribute("class", tokens.join(" "));
				else el.removeAttribute("class");

				const src = el.getAttribute("src") ?? "";
				if (!/^(?:https?:\/\/|\/[^/])/i.test(src)) {
					el.remove();
					continue;
				}
				el.setAttribute("loading", "lazy");
				el.setAttribute("decoding", "async");
				el.setAttribute("referrerpolicy", "no-referrer");
			}
		}
	};

	walk(template.content);
	return template.innerHTML;
}

/** 把 Markdown 渲染成可安全插入气泡的 HTML */
function renderMarkdown(text: string): string {
	return sanitizeHtml(md.parse(text) as string);
}

/** 代码块顶栏要用的三条文案，由 Astro 那边按语言渲染好传进来 */
export interface CodeLabels {
	copy: string;
	copied: string;
	code: string;
}

/**
 * 给代码块补一条「语言 + 复制」的顶栏。
 * 这一步放在消毒之后：白名单要是放行 button，注入面就跟着变大，
 * 索性让 marked 只吐标准的 <pre><code class="language-x">，按钮由我们自己拼。
 */
function decorateCodeBlocks(root: HTMLElement, labels: CodeLabels): void {
	for (const pre of root.querySelectorAll("pre")) {
		const code = pre.querySelector("code");
		if (!code) continue;

		const lang = (
			code.className.match(/language-([\w+#.-]+)/)?.[1] ?? ""
		).toLowerCase();

		const block = document.createElement("div");
		block.className = "tg-code";

		const head = document.createElement("div");
		head.className = "tg-code-head";

		const name = document.createElement("span");
		name.className = "tg-code-lang";
		name.textContent = LANG_NAMES[lang] ?? (lang || labels.code);

		const copy = document.createElement("button");
		copy.type = "button";
		copy.className = "tg-code-copy";
		copy.dataset.tgCopy = "";
		copy.textContent = labels.copy;

		head.append(name, copy);
		pre.replaceWith(block);
		block.append(head, pre);
	}
}

/** 渲染一段 Markdown 到气泡里：解析 → 消毒 → 补代码块顶栏 */
export function setMarkdown(
	target: HTMLElement,
	text: string,
	labels: CodeLabels,
): void {
	target.innerHTML = renderMarkdown(text);
	decorateCodeBlocks(target, labels);
}

/**
 * 空态占位：一张插画 + 一句文案。
 * 插画是全站统一的那张（ui/empty-lottie），尺寸由 comment.css 的
 * `[data-tg-state="empty"]` 控制 —— 抽屉里窄、文章页里宽，同一个素材两种大小。
 */
export function paintEmptyPlaceholder(node: HTMLElement, text: string): void {
	const caption = document.createElement("span");
	caption.textContent = text;
	node.replaceChildren(createEmptyLottie(), caption);
}
