/**
 * 从音频文件里读内嵌封面。
 *
 * 为什么需要它：`<audio>` 只负责解码声音，浏览器不会把内嵌封面（MP3 的 ID3 APIC、
 * MP4 的 covr、FLAC 的 PICTURE 块）暴露给 JS。桌面播放器之所以「自动有封面」，
 * 就是自己解了文件头 —— 这里做同一件事，只取封面所需的头部字节，不整文件下载。
 *
 * 用法：`const pic = await readEmbeddedCover(url)`，返回可直接塞进 `<img>` 的
 * blob URL；读不到返回 null，调用方自己回落到缺省封面。
 */

/** 首段读取量：绝大多数封面在 ID3 开头 / moov 头部，512KB 足够 */
const HEAD_BYTES = 512 * 1024;
/** MP4 的 moov 常被放在文件末尾（未做 faststart），尾部再取 512KB */
const TAIL_BYTES = 512 * 1024;
/** 封面本体上限，防止畸形文件把内存吃光 */
const MAX_COVER_BYTES = 8 * 1024 * 1024;

type RawCover = { mime: string; bytes: Uint8Array };

/** 同一个 URL 只解一次（切歌来回切不必重复请求） */
const cache = new Map<string, Promise<string | null>>();

function u32(b: Uint8Array, o: number): number {
	return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

/** ID3 用的 28 位同步安全整数 */
function syncSafe(b: Uint8Array, o: number): number {
	return (
		((b[o] & 0x7f) << 21) |
		((b[o + 1] & 0x7f) << 14) |
		((b[o + 2] & 0x7f) << 7) |
		(b[o + 3] & 0x7f)
	);
}

function tag(b: Uint8Array, o: number): string {
	return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
}

function guessMime(bytes: Uint8Array): string {
	if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
	if (
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47
	)
		return "image/png";
	if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46)
		return "image/gif";
	if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
		return "image/webp";
	return "image/jpeg";
}

// ── ID3v2（.mp3）─────────────────────────────────────────────
function parseId3(b: Uint8Array): RawCover | null {
	// ID3 是 3 字节标识，第 4 个字节是版本号，不能用 tag() 比
	if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return null;
	const major = b[3];
	const size = syncSafe(b, 6);
	const endOfTag = Math.min(b.length, 10 + size);
	let off = 10;
	// 2.3/2.4 才有扩展头标记，2.2 帧格式完全不同，忽略
	while (off + 10 <= endOfTag) {
		const id = tag(b, off);
		if (id === "\u0000\u0000\u0000\u0000") break;
		const frameSize = major >= 4 ? syncSafe(b, off + 4) : u32(b, off + 4);
		if (frameSize <= 0 || off + 10 + frameSize > endOfTag) break;
		if (id === "APIC") {
			const frame = b.subarray(off + 10, off + 10 + frameSize);
			return parseApic(frame);
		}
		off += 10 + frameSize;
	}
	return null;
}

function parseApic(frame: Uint8Array): RawCover | null {
	if (frame.length < 4) return null;
	const encoding = frame[0];
	let p = 1;
	// MIME（ASCII，0 结尾）
	const mimeStart = p;
	while (p < frame.length && frame[p] !== 0) p++;
	const mime = String.fromCharCode(...frame.subarray(mimeStart, p));
	p++; // 跳过 0
	p++; // 图片类型（3 = front cover，不校验）
	// 描述文本：UTF-16 用双字节 0 结尾，其余单字节
	if (encoding === 1 || encoding === 2) {
		while (p + 1 < frame.length && !(frame[p] === 0 && frame[p + 1] === 0)) p += 2;
		p += 2;
	} else {
		while (p < frame.length && frame[p] !== 0) p++;
		p++;
	}
	if (p >= frame.length) return null;
	const bytes = frame.subarray(p);
	return finishCover(mime, bytes);
}

// ── FLAC（.flac）────────────────────────────────────────────
function parseFlac(b: Uint8Array): RawCover | null {
	if (b.length < 8 || tag(b, 0) !== "fLaC") return null;
	let off = 4;
	while (off + 4 <= b.length) {
		const header = b[off];
		const isLast = (header & 0x80) !== 0;
		const type = header & 0x7f;
		const len = (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3];
		const body = off + 4;
		if (body + len > b.length) return null; // 被截断：交给调用方补读
		if (type === 6) {
			// PICTURE: type(4) mimeLen(4) mime descLen(4) desc w h depth colors dataLen(4) data
			let p = body + 4;
			const mimeLen = u32(b, p);
			p += 4;
			const mime = String.fromCharCode(...b.subarray(p, p + mimeLen));
			p += mimeLen;
			const descLen = u32(b, p);
			p += 4 + descLen + 16;
			const dataLen = u32(b, p);
			p += 4;
			if (p + dataLen > b.length) return null;
			return finishCover(mime, b.subarray(p, p + dataLen));
		}
		if (isLast) break;
		off = body + len;
	}
	return null;
}

// ── MP4 / M4A（.m4a .mp4 .aac）───────────────────────────────
// covr 在 moov/udta/meta/ilst/covr/data，meta 比其它盒子多 4 字节版本号
function findBox(
	b: Uint8Array,
	start: number,
	end: number,
	name: string,
): { body: number; end: number } | null {
	let off = start;
	while (off + 8 <= end) {
		let size = u32(b, off);
		const type = tag(b, off + 4);
		let head = 8;
		if (size === 1) {
			// 64 位长度
			size =
				u32(b, off + 8) * 0x100000000 + u32(b, off + 12);
			head = 16;
		} else if (size === 0) {
			size = end - off;
		}
		if (size < head) return null;
		const boxEnd = Math.min(off + size, end);
		if (type === name) return { body: off + head, end: boxEnd };
		off += size;
	}
	return null;
}

function parseMp4(b: Uint8Array, base: number): RawCover | null {
	// moov 可能在缓冲区任意位置（尾段补读），先定位
	const moov = base === 0 ? findBox(b, 0, b.length, "moov") : scanMoov(b);
	if (!moov) return null;
	const udta = findBox(b, moov.body, moov.end, "udta");
	if (!udta) return null;
	const meta = findBox(b, udta.body, udta.end, "meta");
	if (!meta) return null;
	const ilst = findBox(b, meta.body + 4, meta.end, "ilst");
	if (!ilst) return null;
	const covr = findBox(b, ilst.body, ilst.end, "covr");
	if (!covr) return null;
	const data = findBox(b, covr.body, covr.end, "data");
	if (!data) return null;
	// data 盒子体：1 字节版本 + 3 字节类型标识 + 4 字节 locale，图片跟在后面
	const kind = u32(b, data.body) & 0xffffff;
	const bytes = b.subarray(data.body + 8, data.end);
	if (bytes.length === 0 || bytes.length > MAX_COVER_BYTES) return null;
	const mime = kind === 14 ? "image/png" : kind === 13 ? "image/jpeg" : "";
	return finishCover(mime, bytes);
}

/** 尾段缓冲区里扫 moov 头：向前 4 字节是 size，向后是 4 字节类型 */
function scanMoov(b: Uint8Array): { body: number; end: number } | null {
	for (let i = 4; i + 4 < b.length; i++) {
		if (b[i] !== 0x6d || b[i + 1] !== 0x6f || b[i + 2] !== 0x6f || b[i + 3] !== 0x76)
			continue; // 'moov'
		const size = u32(b, i - 4);
		if (size < 8 || i - 4 + size > b.length) continue;
		return { body: i + 4, end: i - 4 + size };
	}
	return null;
}

function finishCover(mime: string, bytes: Uint8Array): RawCover | null {
	if (!bytes.length || bytes.length > MAX_COVER_BYTES) return null;
	return { mime: mime && mime.indexOf("/") > 0 ? mime : guessMime(bytes), bytes };
}

// ── 网络取字节 ──────────────────────────────────────────────
type Chunk = { bytes: Uint8Array; start: number };

async function readChunk(
	url: string,
	range: string,
): Promise<Chunk | null> {
	try {
		const res = await fetch(url, { headers: { Range: range } });
		if (!res.ok) return null;
		const buf = new Uint8Array(await res.arrayBuffer());
		// 服务器忽略 Range 时会回整个文件，Content-Range 能告诉我们真实起点
		const contentRange = res.headers.get("Content-Range");
		let start = 0;
		if (contentRange) {
			const m = /\/(\d+)$/.exec(contentRange);
			const head = /^bytes\s+(\d+)-/i.exec(contentRange);
			if (head) start = Number(head[1]);
			else if (m && range.startsWith("bytes=-")) start = Number(m[1]) - buf.length;
		}
		return { bytes: buf, start: Math.max(0, start) };
	} catch {
		return null;
	}
}

async function extract(url: string): Promise<string | null> {
	let head = await readChunk(url, `bytes=0-${HEAD_BYTES - 1}`);
	if (!head || head.bytes.length === 0) return null;

	// ID3 标签大小写在头部，标签比首段大就精确补读一次
	if (
		head.bytes[0] === 0x49 &&
		head.bytes[1] === 0x44 &&
		head.bytes[2] === 0x33 &&
		head.bytes.length >= 10
	) {
		const tagSize = syncSafe(head.bytes, 6) + 10;
		if (tagSize > head.bytes.length && tagSize <= MAX_COVER_BYTES) {
			const full = await readChunk(url, `bytes=0-${tagSize - 1}`);
			if (full) head = full;
		}
	}

	let cover = parseId3(head.bytes) ?? parseFlac(head.bytes);

	// MP4：头部没找到 moov（没做 faststart 的文件常放尾部），补读尾段再扫一次
	if (!cover && tag(head.bytes, 4) === "ftyp") {
		cover = parseMp4(head.bytes, 0);
		if (!cover && head.bytes.length >= HEAD_BYTES) {
			const tail = await readChunk(url, `bytes=-${TAIL_BYTES}`);
			if (tail) cover = parseMp4(tail.bytes, tail.start);
		}
	}

	if (!cover) return null;
	const blob = new Blob([cover.bytes.slice().buffer], { type: cover.mime });
	return URL.createObjectURL(blob);
}

/**
 * 读某个音频 URL 的内嵌封面；读不到返回 null。
 * 结果按 URL 缓存，重复调用不会重复下载。
 */
export function readEmbeddedCover(url: string): Promise<string | null> {
	const hit = cache.get(url);
	if (hit) return hit;
	const job = extract(url).catch(() => null);
	cache.set(url, job);
	return job;
}
