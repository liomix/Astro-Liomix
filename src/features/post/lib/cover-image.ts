/**
 * 文章封面图（把随机图配置绑定到纯函数上）
 * ---------------------------------------------------------------------------
 * URL 怎么拼在 shared/lib/media/cover-image.ts（纯函数、可单测），
 * 这里只负责把 postConfig.cover 填进去，调用点和以前一样。
 */
import {
	getApiUrlList as listCoverApis,
	processCoverImageSync as pickCoverImage,
} from "@/shared/lib/media/cover-image";
import { postConfig } from "../config";

const randomCover = postConfig.cover.randomCoverImage;

export function processCoverImageSync(
	image: string | undefined,
	seed?: string,
): string {
	return pickCoverImage(image, seed, randomCover);
}

export function getApiUrlList(
	image: string | undefined,
	seed?: string,
): string[] {
	return listCoverApis(image, seed, randomCover);
}
