/**
 * 随机封面图 URL 计算（纯函数）
 * ---------------------------------------------------------------------------
 * 这里只做「给定 API 列表时怎么拼 URL」，不认识 coverImageConfig ——
 * 配置由调用方传入：文章域传自己的 config，remark 插件由 astro.config 注入。
 * 这样 shared 不会反向依赖任何业务域。
 */

export interface RandomCoverConfig {
	enable: boolean;
	apis: readonly string[];
}

/** 根据 seed 生成确定性 hash 值 */
function getSeedHash(seed?: string): number {
	return seed
		? Math.abs(
				seed.split("").reduce((acc, char) => {
					return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
				}, 0),
			)
		: 0;
}

/** 为 API URL 添加 seed 参数，确保每篇文章获取不同图片 */
function appendSeedParam(apiUrl: string, hash: number): string {
	if (hash === 0) return apiUrl;
	const separator = apiUrl.includes("?") ? "&" : "?";
	return `${apiUrl}${separator}v=${hash}`;
}

/**
 * 处理文章封面图。
 * 当 image 字段为 "api" 时返回第一个 API 的 URL（客户端会按顺序尝试所有 API）。
 *
 * @param image - frontmatter 中的 image 字段
 * @param seed - 生成唯一 URL 的种子（文章 id 或 slug）
 * @param config - 随机封面图开关与 API 列表
 */
export function processCoverImageSync(
	image: string | undefined,
	seed: string | undefined,
	config: RandomCoverConfig,
): string {
	if (!image) return "";
	if (image !== "api") return image;
	if (!config.enable || config.apis.length === 0) return "";

	const hash = getSeedHash(seed);
	return appendSeedParam(config.apis[0], hash);
}

/**
 * 获取所有随机封面图 API URL（带 seed 参数）。
 * 用于客户端按顺序重试，第一个成功即使用。
 */
export function getApiUrlList(
	image: string | undefined,
	seed: string | undefined,
	config: RandomCoverConfig,
): string[] {
	if (image !== "api" || !config.enable) return [];

	const hash = getSeedHash(seed);
	return config.apis.map((api) => appendSeedParam(api, hash));
}
