/**
 * 动态卡片底部操作条：点赞 / 评论
 * 用 document 级事件委托统一处理，动态页（模板克隆）与侧栏弹窗（Svelte）共用
 * - 点赞：行为在 utils/likes.ts（服务端 /api/v1/posts/{slug}/likes），这里只负责把数字画出来
 * - 评论：从右侧抽出评论抽屉（CommentDrawer），见 dynamic-comment-drawer.ts
 */

import {
	bindCommentDrawer,
	closeCommentDrawer,
	openCommentDrawer,
	scheduleDrawerWarm,
} from "@/components/dynamic/dynamic-comment-drawer.ts";
import { registerDynamicLottieIcons } from "@/components/dynamic/dynamic-lottie-icon.ts";
import { bindLikeButtons, syncLikeStates } from "@/utils/likes";
import { formatCompactNumber } from "@/utils/number-utils";

/**
 * 这个模块同时被动态流和侧栏弹窗两个岛 import，dev 下 Vite 有机会把它实例化两份。
 * 只用模块内的布尔量挡不住 —— 两份各挂一个捕获监听，点一次会连续点赞 + 取消，
 * 表现就是「点了没反应」。所以再用一个挂在 window 上的标记做全局去重。
 */
const BOUND_KEY = "__fireflyDynamicActionsBound";

let registered = false;

/**
 * 评论数：由数据源（或后端批量计数）写进 `data-comment-base`，这里只负责画出来。
 * 刚发的评论还在待审核，不会立刻加进这个数字 —— 它与抽屉里看到的条数一致。
 */
function paintCommentCount(button: HTMLElement): void {
	const node = button.querySelector<HTMLElement>("[data-comment-count]");
	if (!node) return;
	const base = Number(button.dataset.commentBase ?? "") || 0;
	node.textContent = formatCompactNumber(base);
}

/** 把已点赞状态同步到（新渲染出来的）按钮上 */
export function syncDynamicLikeStates(root: ParentNode = document): void {
	// 点赞状态与数字由通用模块统一画（文章页、动态页共用一份记录）
	syncLikeStates(root);
	// 评论数不依赖点赞状态，单独刷一遍（模板克隆出来的条目初始只有占位 0）
	root
		.querySelectorAll<HTMLElement>("[data-comment-open]")
		.forEach((button) => paintCommentCount(button));
}

function toggleComments(button: HTMLElement): void {
	// 评论地址挂在条目上（由 SSR 或模板克隆时写入）；本站没接评论服务时为空，
	// 那时抽屉照样抽出，里面给一句「评论系统未配置」的空态
	const entry = button.closest<HTMLElement>("[data-dynamic-entry]");
	if (!entry) return;
	// 已贴着这条动态打开着 → 收起；否则（含切到另一条）打开并换内容
	if (button.classList.contains("is-active")) {
		closeCommentDrawer();
		return;
	}
	// 这里刻意不播图标动画：气泡素材是白色，播起来像闪一下白团；
	// 点击态的颜色变化交给 .is-active（图标 fill 走 currentColor）
	openCommentDrawer(
		entry.dataset.commentSrc ?? "",
		button,
		entry.dataset.commentEmpty ?? "",
	);
}

function onClick(event: MouseEvent): void {
	if (event.button !== 0) return;
	const target = event.target as Element | null;
	const button = target?.closest<HTMLElement>("[data-comment-open]");
	if (!button) return;
	// 同一个事件只处理一次：万一模块被实例化两份、挂了两个监听，
	// 点赞会「点一次等于点两次」（加了又删），表现就是点了没反应
	const flags = event as MouseEvent & { __dynamicActionHandled?: boolean };
	if (flags.__dynamicActionHandled) return;
	flags.__dynamicActionHandled = true;

	// 按钮可能嵌在卡片内，阻止冒泡以免触发上层的链接/路由
	event.preventDefault();
	event.stopPropagation();

	if (button.hasAttribute("data-comment-open")) {
		toggleComments(button);
	}
}

/** 注册一次即可，在动态页与侧栏弹窗里都可调用 */
export function registerDynamicActions(): void {
	// 抽屉外壳只认几何与开合，顶栏内容（昵称 / 头像 / 关闭文案）都由评论页自己渲染，
	// 所以这里不需要再传任何站点信息
	bindCommentDrawer();
	// 每次进动态页（含 Swup 换页后重新挂载）都排一次空闲预热：
	// 触屏 / 键盘这些没有悬浮事件的路径，靠它才能做到「点开就是壁纸」
	scheduleDrawerWarm();

	if (registered) return;
	registered = true;

	const scope = window as unknown as Record<string, boolean | undefined>;
	if (scope[BOUND_KEY]) return;
	scope[BOUND_KEY] = true;

	registerDynamicLottieIcons();
	// 点赞的点击委托也在这里注册：侧栏弹窗里的点赞按钮所在的页面（首页、归档……）
	// 不一定有 LikeButton 组件，光靠组件的脚本会让那颗按钮点了没反应。
	bindLikeButtons();
	document.addEventListener("click", onClick, true);
	syncDynamicLikeStates();
}
