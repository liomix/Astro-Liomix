import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COMMENT_MSG, COMMENT_MSG_VERSION } from "./comment-postmessage";

/**
 * 这两端靠字符串通信，没有类型系统保护 —— 改一个常量，另一边不会编译报错，
 * 只是「点了没反应」。所以把字符串本身钉在测试里。
 * 改协议的正确姿势：新增常量、升版本、两端同时改，再更新这里的断言。
 */
describe("评论 postMessage 协议", () => {
	it("版本号是 1（破坏性变更要同时升这个数与两端的兼容分支）", () => {
		assert.equal(COMMENT_MSG_VERSION, 1);
	});

	it("消息 type 的字符串保持不变", () => {
		assert.deepEqual(
			{ ...COMMENT_MSG },
			{
				theme: "dynamic-comment-theme",
				path: "dynamic-comment-path",
				wallpaper: "dynamic-comment-wallpaper",
				close: "dynamic-comment-close",
				parentRequest: "guest-parent-request",
				parent: "guest-parent",
			},
		);
	});
});
