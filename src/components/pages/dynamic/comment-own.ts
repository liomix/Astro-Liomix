/**
 * 「我发过的评论」的本地记录。
 * ---------------------------------------------------------------------------
 * 后端不回传作者邮箱（那是审核用的），所以刷新之后没有别的办法知道哪条是自己
 * 发的。这份记录解决两件事：
 *
 *   1. 布局：id 在集合里 → 气泡放右侧（自己），否则放左侧（别人）。
 *   2. 撤回：创建评论时后端给一个只够删这一条的凭据，存下来才能在下次打开时
 *      还能撤回。它只存在这台设备上 —— 换了浏览器就只剩管理员能删，这是
 *      匿名评论的代价，也是它不引入账号体系的原因。
 *
 * 两个键分开存：id 决定气泡放哪一边，凭据决定能不能删。分开的好处是失效
 * 互不牵连 —— 凭据缺了（换设备、清过缓存）自己的气泡仍在右边，清掉布局记录
 * 也不会连删除凭据一起抹掉；写入失败时同样只丢其中一项。
 */

/** 自己发过的评论 id（JSON 数组，用来决定气泡左右） */
const OWN_IDS_KEY = "firefly-dynamic-own-comments";

/** id → 撤回凭据 */
const OWN_TOKENS_KEY = "firefly-dynamic-own-tokens";

/**
 * id → 发表时用的身份（邮箱优先，没有邮箱就用昵称）
 *
 * 光有 id 只能回答「这台设备发过这条」，回答不了「现在还是同一个人吗」：
 * 把资料从 A 改成 B 之后，A 那些气泡仍会因为 id 在集合里而被画到右侧。
 * 记下身份，渲染时和当前身份比一次，A 的气泡自然回到左边。
 * 老记录没有这个键，按「就是当前身份」处理，不影响已有数据。
 */
const OWN_IDENTITY_KEY = "firefly-dynamic-own-identities";

/** 两个键各只记最近这么多条，避免 localStorage 无限增长 */
const MAX_ENTRIES = 300;

function readJSON(key: string): unknown {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : null;
	} catch {
		// 隐私模式读不出来、或者存的是坏 JSON：当成「没有记录」
		return null;
	}
}

function writeJSON(key: string, value: unknown): void {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// 隐私模式写不进去：本次会话仍按内存里的集合渲染，
		// 刷新后自己的评论会回到左侧、也撤回不了 —— 不影响其它功能
	}
}

/** 读「我发过的评论」；没存过、解析失败都当成空集 */
export function readOwnComments(): Set<string> {
	const parsed = readJSON(OWN_IDS_KEY);
	return new Set(
		Array.isArray(parsed)
			? parsed.filter((id): id is string => typeof id === "string")
			: [],
	);
}

/**
 * 身份指纹：昵称 + 邮箱。
 *
 * 不能只用邮箱：改资料时很多人只改昵称，邮箱不动 —— 那样指纹不变，
 * 换身份后旧气泡就不会重新排。任何一个字段变了，就是另一个人。
 */
export function identityKeyOf(user: { name: string; email: string } | null): string {
	if (!user) return "";
	return `${user.name.trim().toLowerCase()}\u0000${user.email.trim().toLowerCase()}`;
}

/** 读「每条自己评论是用哪个身份发的」 */
export function readOwnIdentities(): Map<string, string> {
	const parsed = readJSON(OWN_IDENTITY_KEY);
	const out = new Map<string, string>();
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return out;
	for (const [id, identity] of Object.entries(parsed)) {
		if (typeof identity === "string" && identity !== "") out.set(id, identity);
	}
	return out;
}

function writeIdentities(identities: Map<string, string>): void {
	// 和 ids 一样只留最近 MAX_ENTRIES 条：Map 保留插入顺序
	const kept = Array.from(identities.entries()).slice(-MAX_ENTRIES);
	writeJSON(OWN_IDENTITY_KEY, Object.fromEntries(kept));
}

function readTokens(): Record<string, string> {
	const parsed = readJSON(OWN_TOKENS_KEY);
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
	const tokens: Record<string, string> = {};
	for (const [id, token] of Object.entries(parsed)) {
		if (typeof token === "string" && token !== "") tokens[id] = token;
	}
	return tokens;
}

/**
 * 记下刚发出的一条评论。
 *
 * `deleteToken` 只有创建响应里那一次能拿到，漏了就再也补不回来 —— 所以发送
 * 成功的第一时间就要调这里，不能等下次打开评论时才补。
 */
export function rememberOwnComment(
	id: string,
	deleteToken?: string,
	identity?: string,
): void {
	if (!id) return;

	const ids = Array.from(readOwnComments());
	ids.push(id);
	writeJSON(OWN_IDS_KEY, ids.slice(-MAX_ENTRIES));

	if (identity) {
		const identities = readOwnIdentities();
		identities.delete(id);
		identities.set(id, identity);
		writeIdentities(identities);
	}

	if (!deleteToken) return;
	const tokens = readTokens();
	tokens[id] = deleteToken;
	// 对象保留插入顺序，砍掉最早的那些即可
	const kept = Object.entries(tokens).slice(-MAX_ENTRIES);
	writeJSON(OWN_TOKENS_KEY, Object.fromEntries(kept));
}

/** 取一条自己评论的撤回凭据；没发过、或换了设备，返回空串 */
export function deleteTokenOf(id: string): string {
	return readTokens()[id] ?? "";
}

/** 撤回成功后把这条从记录里清掉：它已经不存在了，留着只会让数字越攒越多 */
export function forgetOwnComment(id: string): void {
	const ids = Array.from(readOwnComments()).filter((own) => own !== id);
	writeJSON(OWN_IDS_KEY, ids);

	const tokens = readTokens();
	if (id in tokens) {
		delete tokens[id];
		writeJSON(OWN_TOKENS_KEY, tokens);
	}

	const identities = readOwnIdentities();
	if (identities.delete(id)) writeIdentities(identities);
}
