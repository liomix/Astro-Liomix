/**
 * 动图 / 视频识别（纯字节判断，不依赖 fs、glob、配置文件）。
 * 供头像组件与 OG 图生成复用，任何环境都能安全导入。
 */

/** 只能靠扩展名判断的动图格式（webp/avif 动静态同扩展名，必须嗅探文件头） */
const ANIMATED_EXTENSIONS = /\.(gif|apng)$/i;

/** 可作为动态头像渲染的视频格式 */
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv)$/i;

export function hasAnimatedExtension(src: string): boolean {
	return ANIMATED_EXTENSIONS.test(stripQuery(src));
}

export function hasVideoExtension(src: string): boolean {
	return VIDEO_EXTENSIONS.test(stripQuery(src));
}

function stripQuery(src: string): string {
	return src.split(/[?#]/)[0];
}

/**
 * 文件头是否带「多帧」特征：
 * - GIF87a / GIF89a
 * - APNG（PNG 签名 + acTL 块）
 * - 动态 WebP（RIFF....WEBP + ANIM/ANMF 块）
 * - 动态 AVIF（ftyp 主品牌 avis）
 */
export function isAnimatedImageBuffer(buffer: Buffer): boolean {
	if (buffer.length < 12) return false;
	const head = buffer.subarray(0, 12).toString("latin1");

	if (/^GIF8[79]a/.test(head)) return true;
	if (head.startsWith("\x89PNG")) return buffer.includes("acTL", 0, "latin1");
	if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") {
		return (
			buffer.includes("ANIM", 0, "latin1") ||
			buffer.includes("ANMF", 0, "latin1")
		);
	}
	if (head.slice(4, 8) === "ftyp") return head.slice(8, 12) === "avis";
	return false;
}
