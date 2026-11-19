import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getApiUrlList, processCoverImageSync } from "./cover-image";

const enabled = {
	enable: true,
	apis: ["https://a.test/pc", "https://b.test/pc"],
};
const disabled = { enable: false, apis: ["https://a.test/pc"] };

describe("processCoverImageSync", () => {
	it("无 image 或非 api 时原样返回（不改外链与站内路径）", () => {
		assert.equal(processCoverImageSync(undefined, "post", enabled), "");
		assert.equal(processCoverImageSync("", "post", enabled), "");
		assert.equal(
			processCoverImageSync("https://cdn.test/a.webp", "post", enabled),
			"https://cdn.test/a.webp",
		);
		assert.equal(
			processCoverImageSync("/assets/a.webp", "post", enabled),
			"/assets/a.webp",
		);
	});

	it("开关关闭或 API 为空时返回空串", () => {
		assert.equal(processCoverImageSync("api", "post", disabled), "");
		assert.equal(
			processCoverImageSync("api", "post", { enable: true, apis: [] }),
			"",
		);
	});

	it("同一 seed 结果稳定，不同 seed 得到不同参数", () => {
		const a = processCoverImageSync("api", "posts/hello", enabled);
		const b = processCoverImageSync("api", "posts/hello", enabled);
		const c = processCoverImageSync("api", "posts/world", enabled);
		assert.equal(a, b);
		assert.notEqual(a, c);
		assert.ok(a.startsWith("https://a.test/pc"));
	});

	it("已有 query 的 API 用 & 拼接", () => {
		const url = processCoverImageSync("api", "post", {
			enable: true,
			apis: ["https://api.test/random?type=pc"],
		});
		assert.ok(url.startsWith("https://api.test/random?type=pc&v="));
	});
});

describe("getApiUrlList", () => {
	it("关闭时返回空数组", () => {
		assert.deepEqual(getApiUrlList("api", "post", disabled), []);
		assert.deepEqual(getApiUrlList("https://x/y.webp", "post", enabled), []);
	});

	it("开启时按列表顺序返回，全部带同一个 seed 参数", () => {
		const urls = getApiUrlList("api", "posts/hello", enabled);
		assert.equal(urls.length, 2);
		assert.ok(urls[0].startsWith("https://a.test/pc"));
		assert.ok(urls[1].startsWith("https://b.test/pc"));
		const seedOf = (u: string) => u.split("v=")[1];
		assert.equal(seedOf(urls[0]), seedOf(urls[1]));
	});
});
