#!/usr/bin/env node
/**
 * 头像转码：把视频 / GIF 转成体积可控、可无限循环的动态头像。
 *
 * 用法：
 *   pnpm avatar:convert <输入文件> [选项]
 *
 * 常用选项：
 *   --out <路径>       输出文件，默认 src/assets/images/avatar-motion.mp4
 *   --size <像素>      输出边长，默认 256（96~112px 头像的 2x 屏够用）
 *   --fps <帧率>       默认 12，动图头像不需要高帧率；mp4 建议 15，循环最顺
 *   --quality <0-100>  画质，默认 62（webp 为编码质量；mp4 会换算成 CRF，数值越高画质越好）
 *   --start <秒>       从第几秒开始截，默认 0
 *   --duration <秒>    截取时长，默认整段
 *   --format <类型>    mp4（默认，体积最小、循环最顺）/ webp / gif
 *   --square <位置>    正方形裁剪位置 center|top|left|right，默认 center
 *
 * 依赖 ffmpeg，按以下顺序查找：环境变量 FFMPEG_PATH → 本地 ffmpeg-static →
 * @ffmpeg-installer → 系统 PATH。都没有时脚本会给出安装提示。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_OUT = "src/assets/images/avatar-motion.mp4";

function parseArgs(argv) {
	const args = { input: "", out: "", size: 256, fps: 12, quality: 62, start: 0, duration: null, format: "mp4", square: "center" };
	const rest = [];
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (!arg.startsWith("--")) {
			rest.push(arg);
			continue;
		}
		const key = arg.slice(2);
		const value = argv[i + 1];
		if (value === undefined || value.startsWith("--")) continue;
		i += 1;
		switch (key) {
			case "out":
				args.out = value;
				break;
			case "size":
				args.size = Number(value);
				break;
			case "fps":
				args.fps = Number(value);
				break;
			case "quality":
				args.quality = Number(value);
				break;
			case "start":
				args.start = Number(value);
				break;
			case "duration":
				args.duration = Number(value);
				break;
			case "format":
				args.format = value;
				break;
			case "square":
				args.square = value;
				break;
			default:
				break;
		}
	}
	args.input = rest[0] || "";
	return args;
}

function hasBinary(bin) {
	try {
		execFileSync(bin, ["-version"], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

function resolveFfmpeg() {
	const candidates = [];
	if (process.env.FFMPEG_PATH) candidates.push(process.env.FFMPEG_PATH);

	const exe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
	const prefixes = ["", "node_modules/@ffmpeg-installer", "node_modules/ffmpeg-static"];
	for (const prefix of prefixes) {
		const guesses = [
			path.join(prefix, exe),
			path.join(prefix, process.platform === "win32" ? "win32-x64" : `${process.platform}-${process.arch}`, exe),
		];
		for (const guess of guesses) {
			if (fs.existsSync(guess)) candidates.push(path.resolve(guess));
		}
	}

	candidates.push("ffmpeg");

	for (const candidate of candidates) {
		if (candidate && (candidate === "ffmpeg" ? hasBinary(candidate) : fs.existsSync(candidate) && hasBinary(candidate))) {
			return candidate;
		}
	}
	return "";
}

function buildFilters(args) {
	const pos = {
		center: "crop='min(iw,ih)':'min(iw,ih)'",
		top: "crop='min(iw,ih)':'min(iw,ih)':(iw-min(iw,ih))/2:0",
		left: "crop='min(iw,ih)':'min(iw,ih)':0:(ih-min(iw,ih))/2",
		right: "crop='min(iw,ih)':'min(iw,ih)':iw-min(iw,ih):(ih-min(iw,ih))/2",
	}[args.square] || "crop='min(iw,ih)':'min(iw,ih)'";
	return [pos, `scale=${args.size}:${args.size}:flags=lanczos`, `fps=${args.fps}`].join(",");
}

function humanSize(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const args = parseArgs(process.argv.slice(2));
if (!args.input) {
	console.error("用法: pnpm avatar:convert <输入文件> [--out 路径] [--size 256] [--fps 12] [--quality 62] [--format webp|mp4|gif]");
	process.exit(1);
}
if (!fs.existsSync(args.input)) {
	console.error(`输入文件不存在: ${args.input}`);
	process.exit(1);
}

const ffmpeg = resolveFfmpeg();
if (!ffmpeg) {
	console.error(
		[
			"未找到 ffmpeg。任选一种方式安装后重试：",
			"  1) pnpm add -D @ffmpeg-installer/ffmpeg（二进制走 npm registry，国内可用）",
			"  2) pnpm add -D ffmpeg-static（二进制走 GitHub Release，网络受限时可能失败）",
			"  3) 安装系统版 ffmpeg 并加入 PATH，或设置环境变量 FFMPEG_PATH 指向可执行文件",
		].join("\n"),
	);
	process.exit(1);
}

const out = path.resolve(
	args.out || DEFAULT_OUT.replace(/\.(mp4|webp|gif)$/, `.${args.format}`),
);
fs.mkdirSync(path.dirname(out), { recursive: true });

const filters = buildFilters(args);
const encode = {
	webp: ["-c:v", "libwebp", "-lossless", "0", "-q:v", String(args.quality), "-compression_level", "6", "-loop", "0"],
	mp4: ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", String(Math.min(40, Math.round((100 - args.quality) / 2) + 18)), "-movflags", "+faststart"],
	gif: ["-loop", "0"],
};
if (!encode[args.format]) {
	console.error(`不支持的输出格式: ${args.format}`);
	process.exit(1);
}

const command = [
	"-y",
	"-loglevel",
	"error",
	...(args.start ? ["-ss", String(args.start)] : []),
	"-i",
	args.input,
	...(args.duration ? ["-t", String(args.duration)] : []),
	"-an",
	"-vf",
	args.format === "gif" ? `${filters},split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer` : filters,
	...encode[args.format],
	out,
];

console.log(`[avatar] ffmpeg: ${ffmpeg}`);
console.log(`[avatar] 输入  : ${args.input}`);
console.log(`[avatar] 输出  : ${out}  (${args.size}px / ${args.fps}fps / ${args.format})`);

try {
	execFileSync(ffmpeg, command, { stdio: "inherit" });
} catch (error) {
	console.error(`[avatar] 转码失败: ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
}

const size = fs.statSync(out).size;
console.log(`[avatar] 完成，体积 ${humanSize(size)}`);

if (args.format === "webp" || args.format === "mp4") {
	const rel = path.relative(process.cwd(), out).replace(/\\/g, "/");
	console.log(`[avatar] 在 src/config/profileConfig.ts 里设置 avatar: "${rel.replace(/^src\//, "")}"`);
	if (args.format === "mp4") {
		console.log("[avatar] 提示: 再截一张首帧图作为 avatarPoster，首帧渲染和 OG 图都靠它兜底");
	}
}
