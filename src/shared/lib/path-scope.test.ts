import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesPathScope, normalizePath } from "./path-scope";

describe("normalizePath", () => {
	it("去掉尾部斜杠，根路径保留", () => {
		assert.equal(normalizePath("/archive/"), "/archive");
		assert.equal(normalizePath("/"), "/");
		assert.equal(normalizePath(""), "/");
	});
});

describe("matchesPathScope", () => {
	it("空集合不命中任何路径", () => {
		assert.equal(matchesPathScope("/archive", []), false);
	});

	it("按前缀命中，覆盖分页子路径", () => {
		assert.equal(matchesPathScope("/archive/", ["/archive"]), true);
		assert.equal(matchesPathScope("/archive/2/", ["/archive"]), true);
	});

	it("不把相邻目录当成前缀", () => {
		// /archived 不能被 /archive 命中
		assert.equal(matchesPathScope("/archived", ["/archive"]), false);
	});

	it("根路径只精确命中首页", () => {
		assert.equal(matchesPathScope("/", ["/"]), true);
		assert.equal(matchesPathScope("/posts/x", ["/"]), false);
	});

	it("忽略 query 与 hash", () => {
		assert.equal(matchesPathScope("/guestbook/?page=2", ["/guestbook"]), true);
		assert.equal(matchesPathScope("/guestbook/#top", ["/guestbook"]), true);
	});
});
