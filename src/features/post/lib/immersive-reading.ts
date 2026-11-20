import type { ImmersiveReadingConfig } from "@/features/post/types";
import { siteConfig } from "@/shared/config/siteConfig";
import I18nKey from "@/shared/i18n/i18nKey";
import { i18n } from "@/shared/i18n/translation";
import { refreshSidebarStickyState } from "@/shared/lib/layout/grid-layout";
import { isPostPage, TOCManager } from "./toc-utils";

/**
 * 沉浸阅读的运行态。
 *
 * 这里**不能**在模块顶层读写 window：域出口 `@/features/post` 会被 Node 预渲染的
 * 图片端点 import，顶层碰 window 会让 `astro build` 直接 `window is not defined`
 * （规范 §6.5）。所以状态与全局函数都推迟到 initImmersiveReading() 里建立。
 */
type ImmersiveState = NonNullable<typeof window.ImmersiveReading>;

let state: ImmersiveState | null = null;

function ensureState(): ImmersiveState {
	if (state) return state;
	state = window.ImmersiveReading ?? {
		btn: null,
		tocBtn: null,
		toc: null,
		manager: null,
		prevScroll: 0,
		isImmersive: false,
	};
	window.ImmersiveReading = state;
	return state;
}

/** 用内联 !important 强制内容面板贴顶到 1rem——内联 important 优先于一切样式表规则 */
function clampContentTop(): void {
	const panel = document.querySelector<HTMLElement>(".content-panel");
	if (!panel) return;
	panel.style.setProperty("top", "1rem", "important");
	panel.style.setProperty("min-height", "calc(100vh - 1rem)", "important");
	panel.style.setProperty("--content-top", "1rem", "important");
}

function clearContentTop(): void {
	const panel = document.querySelector<HTMLElement>(".content-panel");
	if (!panel) return;
	panel.style.removeProperty("top");
	panel.style.removeProperty("min-height");
	panel.style.removeProperty("--content-top");
}

function isDesktop(): boolean {
	return window.innerWidth >= 1024;
}

function immersiveConfig(): ImmersiveReadingConfig {
	return (
		siteConfig.post.immersiveReading ?? {
			enable: true,
			defaultOn: false,
			tocEnabled: true,
			tocPosition: "left",
		}
	);
}

/** 目录栏 & 移动端目录开关。切到新文章时再次调用可重建目录（SSR 锚点已过期） */
function setupImmersiveTOC(): void {
	const cfg = immersiveConfig();
	const content = document.getElementById("immersive-toc-content");
	if (cfg.tocEnabled !== false && content) {
		ensureState().tocBtn?.classList.remove("hide");
		// 默认展开目录（桌面/移动一致）；关闭后由 CSS 释放文章让位空间
		ensureState().toc?.classList.add("open");
		ensureState().tocBtn?.classList.add("toggled"); // 目录打开时按钮切到「关闭」图标
		ensureState().tocBtn?.setAttribute("title", i18n(I18nKey.tocCollapse));
		document.body.classList.add("immersive-toc-open");
		try {
			const ir = ensureState();
			ir.manager?.cleanup();
			ir.manager = new TOCManager({
				contentId: "immersive-toc-content",
				indicatorId: "immersive-toc-indicator",
				maxLevel: 3,
				scrollOffset: 80,
			});
			// attach() 自校正：SSR 锚点与当前正文一致则直接附着；
			// 切到别的文章后锚点过期会回退 DOM 遍历重建。
			ensureState().manager?.attach();
		} catch (error) {
			console.error("Failed to init immersive TOC:", error);
		}
	} else {
		ensureState().tocBtn?.classList.add("hide");
		ensureState().toc?.classList.remove("open");
		ensureState().tocBtn?.classList.remove("toggled");
		ensureState().tocBtn?.setAttribute("title", i18n(I18nKey.tocExpand));
		document.body.classList.remove("immersive-toc-open");
	}
}

function enterImmersiveReading(): void {
	if (ensureState().isImmersive) return;
	// 仅在桌面端提供沉浸阅读
	if (!isPostPage() || !isDesktop()) return;
	ensureState().isImmersive = true;
	ensureState().prevScroll = window.scrollY;

	document.body.classList.add("immersive-reading");
	clampContentTop();
	const cfg = immersiveConfig();
	document.body.classList.toggle(
		"immersive-toc-right",
		cfg.tocPosition === "right",
	);

	// 进/出按钮：去掉 .hide，切换为退出图标
	ensureState().btn?.classList.remove("hide");
	ensureState().btn?.classList.add("toggled");
	ensureState().btn?.setAttribute("title", i18n(I18nKey.exitImmersiveReading));

	// 目录栏 & 移动端目录开关
	setupImmersiveTOC();

	// 类 PDF：回到文章顶部开始阅读
	window.scrollTo({ top: 0, behavior: "instant" });

	document.dispatchEvent(
		new CustomEvent("immersiveReadingChange", { detail: { on: true } }),
	);
}

function exitImmersiveReading(): void {
	if (!ensureState().isImmersive) return;
	ensureState().isImmersive = false;

	document.body.classList.remove("immersive-reading");
	document.body.classList.remove("immersive-toc-right");
	document.body.classList.remove("immersive-toc-open");
	clearContentTop();

	// 侧边栏恢复显示后重新测量 top 容器可见性，恢复 mb-4（sticky 与 top 组件之间间距）
	requestAnimationFrame(refreshSidebarStickyState);

	ensureState().manager?.cleanup();
	ensureState().manager = null;

	ensureState().btn?.classList.remove("toggled");
	ensureState().btn?.setAttribute("title", i18n(I18nKey.enterImmersiveReading));
	ensureState().tocBtn?.classList.add("hide");
	ensureState().tocBtn?.classList.remove("toggled");
	ensureState().tocBtn?.setAttribute("title", i18n(I18nKey.tocExpand));
	ensureState().toc?.classList.remove("open");

	// 重新计算按钮可见性：文章页 + 桌面端应恢复「进入」按钮
	updateImmersiveReadingVisibility();

	// 恢复进入前的滚动位置
	window.scrollTo({ top: ensureState().prevScroll || 0, behavior: "instant" });

	document.dispatchEvent(
		new CustomEvent("immersiveReadingChange", { detail: { on: false } }),
	);
}

function toggleImmersiveReading(): void {
	if (ensureState().isImmersive) exitImmersiveReading();
	else enterImmersiveReading();
}

function toggleImmersiveTOC(): void {
	if (!ensureState().isImmersive) return;
	const toc = ensureState().toc;
	if (!toc) return;
	const isOpen = toc.classList.contains("open");
	toc.classList.toggle("open", !isOpen);
	document.body.classList.toggle("immersive-toc-open", !isOpen);
	ensureState().tocBtn?.classList.toggle("toggled", !isOpen);
	// 悬停提示跟随目录开关状态
	ensureState().tocBtn?.setAttribute(
		"title",
		!isOpen ? i18n(I18nKey.tocCollapse) : i18n(I18nKey.tocExpand),
	);
}

// 目录项点击标记为内部导航，避免误触其它「外部链接自动关闭」逻辑
function bindImmersiveTOCNav(): void {
	const tocContent = document.getElementById("immersive-toc-content");
	if (!tocContent) return;
	tocContent.addEventListener(
		"click",
		(e) => {
			const target = e.target as Element | null;
			const anchor = target?.closest('a[href^="#"]');
			if (anchor) window.tocInternalNavigation = true;
		},
		{ capture: true },
	);
}

function updateImmersiveReadingVisibility(): void {
	if (!ensureState().btn) return;
	const enabled = immersiveConfig().enable !== false;

	if (!enabled || !isPostPage() || !isDesktop()) {
		if (ensureState().isImmersive) exitImmersiveReading();
		ensureState().btn?.classList.add("hide");
		ensureState().tocBtn?.classList.add("hide");
		return;
	}
	ensureState().btn?.classList.remove("hide");
}

/** 初始化沉浸阅读：绑定 DOM、更新按钮可见性、注册 Swup/resize/Esc/解密监听（幂等） */
export function initImmersiveReading(): void {
	ensureState();
	// 供内联 onclick（window.toggleImmersiveReading / window.toggleImmersiveTOC）调用。
	// 放在 init 里而不是模块顶层：否则 Node 预渲染 import 到本模块就会崩（§6.5）。
	window.toggleImmersiveReading = toggleImmersiveReading;
	window.toggleImmersiveTOC = toggleImmersiveTOC;
	window.enterImmersiveReading = enterImmersiveReading;
	window.exitImmersiveReading = exitImmersiveReading;
	ensureState().btn = document.getElementById("immersive-reading-btn");
	ensureState().tocBtn = document.getElementById("immersive-toc-toggle-btn");
	ensureState().toc = document.getElementById("immersive-toc");
	bindImmersiveTOCNav();
	updateImmersiveReadingVisibility();

	// 跨 Swup 切到另一篇文章时若仍在沉浸态，重建目录（SSR 锚点已过期）
	if (ensureState().isImmersive) setupImmersiveTOC();

	// 默认开启
	const cfg = immersiveConfig();
	if (cfg.enable !== false && cfg.defaultOn && isPostPage()) {
		enterImmersiveReading();
	}

	// 防止 Swup 切页重跑脚本时重复注册监听器
	if (!window.__immersiveReadingInit) {
		window.__immersiveReadingInit = true;

		document.addEventListener("swup:contentReplaced", () => {
			setTimeout(initImmersiveReading, 100);
		});
		document.addEventListener("astro:page-load", () => {
			setTimeout(initImmersiveReading, 100);
		});
		window.addEventListener("popstate", () => {
			setTimeout(initImmersiveReading, 200);
		});

		// 视口变化：离开桌面端时隐藏按钮并退出沉浸态
		window.addEventListener("resize", () => {
			updateImmersiveReadingVisibility();
		});

		// Esc 退出沉浸阅读
		window.addEventListener("keydown", (e) => {
			if (e.key === "Escape") exitImmersiveReading();
		});

		// 密码解密后重建沉浸目录
		document.addEventListener("password:decrypted", () => {
			setTimeout(() => {
				if (!ensureState().isImmersive) return;
				ensureState().manager?.cleanup();
				ensureState().manager = new TOCManager({
					contentId: "immersive-toc-content",
					indicatorId: "immersive-toc-indicator",
					maxLevel: 3,
					scrollOffset: 80,
				});
				ensureState().manager?.attach();
			}, 200);
		});
	}
}
