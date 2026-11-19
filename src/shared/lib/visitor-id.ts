/**
 * 读者的浏览器标识（visitorId）
 * ---------------------------------------------------------------------------
 * 一个不透明的随机串，存在 localStorage 里，用来让后端把同一个浏览器的多次请求
 * 归到同一位访客：访问统计据此去重，点赞据此判断「这个人是不是已经赞过」。
 *
 * 它不是凭据：拿到了也只能冒充别人点赞/取消点赞，改不了别人的数据。也正因为
 * 如此它不进 URL（会进历史、日志、Referer），读接口放请求头、写接口放路径段。
 *
 * 三个域共用这一份实现（站点统计 / 文章阅读量 / 点赞），改生成规则只需要改这里。
 */
const VISITOR_ID_KEY = "firefly:visitor-id";

/** localStorage 不可用时的会话内 visitorId */
let memoryVisitorId = "";

function mintVisitorId(): string {
	if (window.crypto?.randomUUID) return window.crypto.randomUUID();
	if (window.crypto?.getRandomValues) {
		const bytes = window.crypto.getRandomValues(new Uint8Array(16));
		return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
	}
	return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 稳定的浏览器标识。拿不到 localStorage 时退化为会话内固定值，
 * 至少同一次浏览不会把自己重复算成新访客。
 */
export function getVisitorId(): string {
	try {
		const stored = window.localStorage.getItem(VISITOR_ID_KEY);
		if (stored) return stored;
		const minted = mintVisitorId();
		window.localStorage.setItem(VISITOR_ID_KEY, minted);
		return minted;
	} catch {
		// Safari 隐私模式等场景下 localStorage 会抛异常。
		if (!memoryVisitorId) memoryVisitorId = mintVisitorId();
		return memoryVisitorId;
	}
}
