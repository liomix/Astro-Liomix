/**
 * 路径作用域判定（SSR 与客户端共用）
 * ---------------------------------------------------------------------------
 * 「按路径挑页面」的规则只有一份：导航页纯净模式、宽幅页面布局、文章页纯净模式
 * 都是它的调用方。放进 shared 是因为布局（shared/lib/layout）也要用它，
 * 而 shared 不允许 import 任何业务域。
 */

/** 去掉尾部斜杠；根路径保留为 "/" */
export function normalizePath(path: string): string {
	const trimmed = path.replace(/\/+$/, "");
	return trimmed || "/";
}

/**
 * 某个路径是否落在给定集合里。
 *
 * 按前缀命中：/archive/ 也覆盖 /archive/2/ 这类分页。
 * 根路径 "/" 例外 —— 它是一切路径的前缀，只能精确命中首页。
 */
export function matchesPathScope(pathname: string, paths: string[]): boolean {
	if (!paths.length) return false;
	const current = normalizePath((pathname.split(/[?#]/)[0] || "/").trim());

	for (const path of paths) {
		if (path === "/") {
			if (current === "/") return true;
			continue;
		}
		if (current === path || current.startsWith(`${path}/`)) return true;
	}

	return false;
}
