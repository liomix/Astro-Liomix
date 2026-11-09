import fs from "node:fs";
import path from "node:path";
import { profileConfig } from "@/config/profileConfig";
import {
	hasAnimatedExtension,
	hasVideoExtension,
	isAnimatedImageBuffer,
} from "@/utils/image-animation";
import { url } from "@/utils/url-utils";

/**
 * 动态头像（动图 / 视频）支持。
 *
 * 构建期的 <Picture>/<Image> 会把图片重新编码，动图只剩第一帧、视频根本不能走这条路，
 * 所以「动态」资源一律绕过图片优化，直出原始文件。这里负责：
 * 1. 判断头像源是动图还是视频（本地文件读文件头嗅探，远程地址看扩展名）
 * 2. 给出原始文件的最终 URL（public 拼 base、远程原样、src 资源用 ?url 导入）
 */

/** 用 ?url 拿到原始文件 URL（不经过图片优化），供 src 目录下的动态资源使用 */
const rawAvatarUrls = import.meta.glob<string>(
	"/src/**/*.{gif,apng,png,webp,avif,mp4,webm,mov,m4v,ogv}",
	{ query: "?url", import: "default", eager: true },
);

/** astro dev / build 的工作目录即项目根，构建期读头像文件头用 */
const PROJECT_ROOT = process.cwd();

function isRemote(src: string): boolean {
	return /^(?:https?:)?\/\//i.test(src) || src.startsWith("data:");
}

/** 把头像配置里的 src 换算成本地绝对路径；远程地址返回 null */
function toLocalPath(src: string, basePath = ""): string | null {
	if (!src || isRemote(src)) return null;
	const clean = src.split(/[?#]/)[0];
	const relative = clean.startsWith("/")
		? path.join("public", clean.replace(/^\/+/, ""))
		: path.join("src", basePath.replace(/^\/+/, ""), clean);
	return path.join(PROJECT_ROOT, relative);
}

/** 读文件头判断是否为动图（读不到文件时返回 false，交给静态管线兜底） */
function isAnimatedFile(absPath: string): boolean {
	let fd: number | undefined;
	try {
		const stat = fs.statSync(absPath);
		if (!stat.isFile()) return false;
		const size = Math.min(stat.size, 8192);
		const buffer = Buffer.alloc(size);
		fd = fs.openSync(absPath, "r");
		fs.readSync(fd, buffer, 0, size, 0);
		return isAnimatedImageBuffer(buffer);
	} catch {
		return false;
	} finally {
		if (fd !== undefined) fs.closeSync(fd);
	}
}

/** 头像是否为视频（mp4 / webm / mov …），按扩展名判断即可 */
export function isVideoAvatar(src: string): boolean {
	return Boolean(src) && hasVideoExtension(src);
}

/** 同一头像在列表/侧栏里会渲染多次，嗅探结果按绝对路径缓存，避免重复读盘 */
const animatedCache = new Map<string, boolean>();

/** 头像是否为动图；远程地址只能靠扩展名判断，需要时可被 avatarMotion 强制指定 */
export function isAnimatedImageSource(src: string, basePath = ""): boolean {
	if (!src) return false;
	if (hasAnimatedExtension(src)) return true;
	const absPath = toLocalPath(src, basePath);
	if (!absPath) return false;
	const cached = animatedCache.get(absPath);
	if (cached !== undefined) return cached;
	const result = isAnimatedFile(absPath);
	animatedCache.set(absPath, result);
	return result;
}

/** 头像是否需要绕过图片优化（动图或视频） */
export function isDynamicAvatar(src: string, basePath = ""): boolean {
	return isVideoAvatar(src) || isAnimatedImageSource(src, basePath);
}

/**
 * 配置里 avatarMotion 的覆盖值，供组件当 `animated` prop 传：
 * always → true（强制动态）、never → false（强制静态）、auto / 未填 → undefined（交给自动识别）。
 */
export function avatarMotionOverride(): boolean | undefined {
	const motion = profileConfig.avatarMotion ?? "auto";
	if (motion === "always") return true;
	if (motion === "never") return false;
	return undefined;
}

/** 站点头像是否按动态资源处理：配置策略优先，auto 时自动嗅探 */
export function isProfileAvatarDynamic(): boolean {
	return (
		avatarMotionOverride() ?? isDynamicAvatar(profileConfig.avatar ?? "")
	);
}

/**
 * 动态资源的原始文件 URL：绕过图片优化，保留动画。
 * public 路径补 base，远程原样返回，src 资源走 ?url 导入。
 */
export function resolveRawAvatarUrl(src: string): string {
	if (!src) return "";
	if (isRemote(src)) return src;
	if (src.startsWith("/")) return url(src);

	const key = path.normalize(path.join("/src", src)).replace(/\\/g, "/");
	return rawAvatarUrls[key] ?? "";
}
