/**
 * 导航页纯净模式：路径集合推导 + 命中判定（SSR 与客户端共用）
 * ---------------------------------------------------------------------------
 * 「哪些页面算导航页」不写在配置里，而是从 navBarConfig 的站内链接推导出来，
 * 导航栏增删一项，纯净模式的范围自动跟着变。
 *
 * SSR（MainGridLayout）把结果写进 #main-grid 的 data 属性，客户端切页时只读
 * 属性重算 —— 所以这个模块不 import 任何配置，客户端不会为此多打包一份导航栏。
 */
import type { NavBarLink } from "@/features/navigation/types";
import { matchesPathScope, normalizePath } from "@/shared/lib/path-scope";

export { matchesPathScope };

/** 站点 base（配置为 "/" 时是空串），用来把 /archive/ 这类站点路径对齐成运行时 pathname */
const BASE = (import.meta.env.BASE_URL || "/").replace(/^\/+|\/+$/g, "");

function withBase(path: string): string {
	return BASE ? `/${BASE}${path}` : path;
}

/**
 * 把一个导航链接归一成「站内路径」：去 query/hash、去尾斜杠、补站点 base。
 * 外链、协议链接、纯锚点、相对路径都返回 null —— 它们不构成站内页面。
 */
export function toNavPurityPath(href: string): string | null {
	const raw = href.trim();
	if (!raw || raw.startsWith("#") || raw.startsWith("//")) return null;
	// mailto: / tel: / https: 之类：带协议头的一律当外链
	if (/^[a-z][a-z\d+.-]*:/i.test(raw)) return null;
	if (!raw.startsWith("/")) return null;

	const pathOnly = raw.split(/[?#]/)[0];
	if (!pathOnly) return null;
	return normalizePath(withBase(pathOnly));
}

/**
 * 收集纯净模式覆盖的页面路径（已归一，去重）。
 * links 传 navBarConfig.links；extraPaths 是配置里手工追加的页面；
 * excludePaths 是从自动推导结果里剔除的页面（例如留言板要自己的大页布局，
 * 不该被「只留资料卡」接管）。
 */
export function collectNavPurityPaths(
	links: NavBarLink[],
	extraPaths: string[] = [],
	excludePaths: string[] = [],
): string[] {
	const paths = new Set<string>();

	const walk = (items: NavBarLink[]): void => {
		for (const link of items) {
			if (!link.external) {
				const path = toNavPurityPath(link.url);
				if (path) paths.add(path);
			}
			if (link.children?.length) walk(link.children);
		}
	};

	walk(links);
	for (const extra of extraPaths) {
		const path = toNavPurityPath(extra);
		if (path) paths.add(path);
	}

	// 排除发生在集合成型之后：导航栏里删掉留言板也不该影响别处
	const excluded = excludePaths
		.map((path) => toNavPurityPath(path))
		.filter((path): path is string => !!path);

	return [...paths].filter((path) => !matchesPathScope(path, excluded));
}
