/**
 * ChatContextPop：评论区消息的右键菜单（复制 / 回复 / 撤回）
 * ---------------------------------------------------------------------------
 * 交互照着 Telegram Android 的消息菜单做：右键（移动端长按）在消息上唤出，
 * 菜单贴着指针弹出、超出视口自动翻转，Esc / 点空白 / 滚动都会收起。
 *
 * 三项各自的行为：
 *   - 复制：优先复制消息的 Markdown 原文（发送时存在 data-tg-source 上）；
 *     示例消息没有原文，就从渲染结果里回读纯文本（图片按 alt 取）。
 *     如果用户先在消息里选中了一段文字，则只复制选区 —— 右键会抑制浏览器
 *     自带的「复制」，不接管的话选中文字后右键就复制不到了。
 *   - 回复：输入框上方出现一条引用预览（左侧竖线 + 名字 + 摘要），发送后
 *     引用块嵌进新气泡顶部，点它能跳回原消息并闪一下。
 *   - 撤回：等同 Telegram 的删除，只能删自己发出去的消息（data-tg-side="out"），
 *     别人的消息上这一项不出现。气泡淡出后从列表移除，id 记进 localStorage，
 *     刷新后不会再冒出来。现在所有动态共用同一份示例消息，所以不按 path 分桶
 *     —— 等接了真实评论数据再改成按动态存。
 *
 * 消息 id 由组件在 SSR 阶段写死（msg-1、msg-2…），脚本不按当前顺序现算 ——
 * 否则撤回第 2 条后刷新，原本的第 3 条会顶上来拿到 msg-2，被再删一次。
 */

import { getCommentUser } from "@/components/pages/dynamic/comment-user";

/** 撤回记录的存储键，和 firefly-dynamic-likes 同一套命名 */
const RETRACTED_KEY = "firefly-tg-retracted";

/** 引用预览里的摘要长度上限：超过就截断，够看清是哪条消息 */
const REPLY_SUMMARY_MAX = 90;

/** 移动端长按多久唤出菜单 */
const LONG_PRESS_MS = 480;

/** 长按过程中位移超过这个距离就当用户在滚动，取消唤出 */
const LONG_PRESS_SLOP = 10;

/** 菜单离视口边缘至少留这么多，免得贴边贴到点不到 */
const MENU_MARGIN = 8;

export interface PendingReply {
	/** 原消息的行 id（data-tg-msg） */
	id: string;
	/** 被引用者的显示名 */
	name: string;
	/** 引用摘要（已压成单行并截断） */
	text: string;
}

export interface ChatContextPopHandle {
	/** 取走待发送的引用（取走即清空）；没有回复对象时返回 null */
	takePendingReply(): PendingReply | null;
	/** 给刚创建的气泡挂上引用块（在 append 之前调用即可） */
	decorate(row: HTMLElement, reply: PendingReply): void;
	/** 新消息 append 之后调用：给它一个稳定 id，右键菜单才认得它 */
	registerRow(row: HTMLElement): void;
	/** 消息增删之后重排分组（昵称只在组首、头像只在组尾） */
	relayout(): void;
	/** 清掉全部 document 级监听（抽屉反复挂载时用） */
	destroy(): void;
}

/** 读撤回记录；没存过、解析失败都当成「空」 */
function readRetracted(): Set<string> {
	try {
		const raw = localStorage.getItem(RETRACTED_KEY);
		if (!raw) return new Set();
		const parsed: unknown = JSON.parse(raw);
		return new Set(
			Array.isArray(parsed)
				? parsed.filter((id): id is string => typeof id === "string")
				: [],
		);
	} catch {
		return new Set();
	}
}

function writeRetracted(ids: Set<string>): void {
	try {
		localStorage.setItem(RETRACTED_KEY, JSON.stringify(Array.from(ids)));
	} catch {
		// 隐私模式下写不进去：本次会话里已移除，刷新后会回来，不影响交互
	}
}

/** 展开消息里能看到的文字：文本节点原样、<br> 转换行、图片取 alt、代码块整体保留 */
function plainTextOf(root: Element): string {
	let out = "";
	const walk = (node: Node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			out += node.textContent ?? "";
			return;
		}
		if (node.nodeName === "BR") {
			out += "\n";
			return;
		}
		if (node.nodeName === "IMG") {
			out += (node as HTMLImageElement).alt || "";
			return;
		}
		if (node.nodeName === "PRE") {
			out += `${node.textContent ?? ""}\n`;
			return;
		}
		for (const child of Array.from(node.childNodes)) walk(child);
	};
	walk(root);
	return out.replace(/\n{3,}/g, "\n\n").trim();
}

/** 压成单行：引用摘要只占一行，换行会把它撑成两三行 */
function oneLine(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string, max: number): string {
	const chars = Array.from(text);
	return chars.length > max ? `${chars.slice(0, max).join("")}…` : text;
}

export function initChatContextPop(chat: HTMLElement): ChatContextPopHandle {
	const scroller = chat.querySelector<HTMLElement>("[data-tg-scroll]");
	const menu = chat.querySelector<HTMLElement>("[data-ctx-pop]");
	const ownOnly = chat.querySelector<HTMLElement>("[data-ctx-own-only]");
	const replyBar = chat.querySelector<HTMLElement>("[data-tg-reply]");
	const replyName = chat.querySelector<HTMLElement>("[data-tg-reply-name]");
	const replyText = chat.querySelector<HTMLElement>("[data-tg-reply-text]");
	const toast = chat.querySelector<HTMLElement>("[data-tg-toast]");
	const composer = chat.querySelector<HTMLElement>("[data-tg-input]");

	const labels = {
		copied: chat.dataset.tgLabelCopied || "Copied",
		retracted: chat.dataset.tgLabelRetracted || "Deleted",
		me: chat.dataset.tgLabelMe || "You",
	};
	const noopHandle: ChatContextPopHandle = {
		takePendingReply: () => null,
		decorate: () => {},
		registerRow: () => {},
		relayout: () => {},
		destroy: () => {},
	};
	if (!scroller || !menu) return noopHandle;

	/** 当前正在回复的那条消息；发送后清空 */
	let pending: PendingReply | null = null;
	/** 菜单当前指向的消息行 */
	let activeRow: HTMLElement | null = null;
	let toastTimer = 0;
	let longPressTimer = 0;
	let longPressStart = { x: 0, y: 0 };
	/** 新消息的自增号：SSR 消息占 msg-1…msg-n，新发的接着往后排 */
	let seq = 0;

	const retractedIds = readRetracted();

	const senderName = (): string =>
		getCommentUser()?.name || chat.dataset.tgDefaultName || labels.me;

	/** 消息的显示名：对方取行上的 data-tg-author，自己取当前身份 */
	const nameOf = (row: HTMLElement): string =>
		row.dataset.tgSide === "out" ? senderName() : row.dataset.tgAuthor || "?";

	/** 只有自己发出去的消息能撤回 */
	const isOwn = (row: HTMLElement): boolean => row.dataset.tgSide === "out";

	const textOf = (row: HTMLElement): string => {
		const body = row.querySelector<HTMLElement>(".tg-text");
		return body ? plainTextOf(body) : "";
	};

	const copyOf = (row: HTMLElement): string => {
		const body = row.querySelector<HTMLElement>(".tg-text");
		const source = body?.dataset.tgSource;
		return source?.trim() ? source : textOf(row);
	};

	/** 复制文本：优先 Clipboard API，拿不到权限（老浏览器 / 非安全上下文）就退回 execCommand */
	async function copyText(text: string): Promise<boolean> {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			const area = document.createElement("textarea");
			area.value = text;
			area.setAttribute("readonly", "");
			area.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
			document.body.append(area);
			area.select();
			const ok = document.execCommand("copy");
			area.remove();
			return ok;
		}
	}

	function showToast(message: string): void {
		if (!toast) return;
		window.clearTimeout(toastTimer);
		toast.textContent = message;
		toast.hidden = false;
		// 重播动画：连续撤回两条时第二次也要有个「弹出」的动作
		toast.classList.remove("is-on");
		void toast.offsetWidth;
		toast.classList.add("is-on");
		toastTimer = window.setTimeout(() => {
			toast.classList.remove("is-on");
			toast.hidden = true;
		}, 1800);
	}

	/* ---------------- 分组 ---------------- */

	/**
	 * 重排「谁跟谁是一组」：同一个人的连续消息里，昵称只在第一条、
	 * 头像只在最后一条。撤回或新发消息都会打断 / 接上一组，SSR 时算好的
	 * class 立刻就过时了 —— 撤回一组里的最后一条，整组头像会跟着消失。
	 * 所以每次增删都照当前 DOM 顺序重算一遍，只切 class，不增删节点。
	 */
	function relayout(): void {
		if (!scroller) return;
		const rows = Array.from(scroller.querySelectorAll<HTMLElement>(".tg-row"));
		rows.forEach((row, index) => {
			const isIn = row.dataset.tgSide === "in";
			const author = row.dataset.tgAuthor || "";
			const prev = rows[index - 1];
			const next = rows[index + 1];
			const samePrev =
				isIn &&
				prev?.dataset.tgSide === "in" &&
				(prev.dataset.tgAuthor || "") === author;
			const sameNext =
				isIn &&
				next?.dataset.tgSide === "in" &&
				(next.dataset.tgAuthor || "") === author;
			row.classList.toggle("tg-row--head", isIn && !samePrev);
			row.classList.toggle("tg-row--tail", isIn && !sameNext);
		});
	}

	/* ---------------- 菜单 ---------------- */

	function closeMenu(): void {
		if (!menu || menu.hidden) return;
		menu.hidden = true;
		menu.setAttribute("aria-hidden", "true");
		activeRow = null;
	}

	function placeMenu(x: number, y: number): void {
		if (!menu) return;
		// 先摆到 0,0 量尺寸：hidden 的元素量不出宽高
		menu.style.left = "0px";
		menu.style.top = "0px";
		const rect = menu.getBoundingClientRect();
		const maxX = window.innerWidth - rect.width - MENU_MARGIN;
		const maxY = window.innerHeight - rect.height - MENU_MARGIN;
		const left = Math.min(
			Math.max(MENU_MARGIN, x),
			Math.max(MENU_MARGIN, maxX),
		);
		const top = Math.min(Math.max(MENU_MARGIN, y), Math.max(MENU_MARGIN, maxY));
		menu.style.left = `${Math.round(left)}px`;
		menu.style.top = `${Math.round(top)}px`;
	}

	function openMenu(row: HTMLElement, x: number, y: number): void {
		if (!menu) return;
		activeRow = row;
		// 别人的消息没有「撤回」：开关和分隔线一起收，菜单会重新排一次高度
		if (ownOnly) ownOnly.hidden = !isOwn(row);
		menu.hidden = false;
		menu.setAttribute("aria-hidden", "false");
		placeMenu(x, y);
		// 焦点只交给菜单本身：落到第一项会让「复制」一开就带一圈高亮。
		// 键盘用户按 ↓ 进第一项，焦点仍在这个菜单里，Esc / ↓↑ 照旧好用
		menu.focus({ preventScroll: true });
	}

	/* ---------------- 回复 ---------------- */

	function clearReply(): void {
		pending = null;
		if (replyBar) replyBar.hidden = true;
	}

	function startReply(row: HTMLElement): void {
		pending = {
			id: row.dataset.tgMsg || "",
			name: nameOf(row),
			text: truncate(oneLine(textOf(row)), REPLY_SUMMARY_MAX),
		};
		if (replyName) replyName.textContent = pending.name;
		if (replyText) replyText.textContent = pending.text || "…";
		if (replyBar) replyBar.hidden = false;
		// 让聊天页把表情面板收起来：回复条和面板都贴在输入框上，同时出现会打架
		chat.dispatchEvent(new CustomEvent("tg-reply-start"));
		composer?.focus({ preventScroll: true });
		scroller?.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
	}

	/* ---------------- 撤回 ---------------- */

	function rememberRetracted(id: string): void {
		if (!id) return;
		retractedIds.add(id);
		writeRetracted(retractedIds);
	}

	function retract(row: HTMLElement): void {
		// 菜单里已经不给别人的消息开这一项，这里再兜一次：
		// 权限判断不能只靠 UI 隐藏，键盘/脚本触发也不能越界
		if (!isOwn(row)) return;
		const id = row.dataset.tgMsg ?? "";
		rememberRetracted(id);
		row.classList.add("is-retracting");
		// 动画结束再摘掉；prefers-reduced-motion 下 CSS 没有过渡，这里的延时也无害
		window.setTimeout(() => {
			row.remove();
			// 少了一条，分组可能变（同一个人被拆开、或前后合并），重排一次
			relayout();
			// 引用它的人还在等这条消息，清掉预览，免得发出去指向一条已经不在的消息
			if (pending && pending.id === id) clearReply();
		}, 200);
		showToast(labels.retracted);
	}

	/* ---------------- 引用块 ---------------- */

	function jumpTo(id: string): void {
		const target = Array.from(
			scroller?.querySelectorAll<HTMLElement>("[data-tg-msg]") ?? [],
		).find((row) => row.dataset.tgMsg === id);
		if (!target) return;
		target.scrollIntoView({ behavior: "smooth", block: "center" });
		target.classList.remove("is-flash");
		// 重播高亮：连点同一个引用也要闪一下
		void target.offsetWidth;
		target.classList.add("is-flash");
		window.setTimeout(() => target.classList.remove("is-flash"), 900);
	}

	function decorate(row: HTMLElement, reply: PendingReply): void {
		const bubble = row.querySelector<HTMLElement>(".tg-bubble");
		const body = bubble?.querySelector<HTMLElement>(".tg-text");
		if (!bubble || !body) return;

		const quote = document.createElement("button");
		quote.type = "button";
		quote.className = "tg-quote";
		quote.dataset.tgQuoteTarget = reply.id;

		const quoteName = document.createElement("span");
		quoteName.className = "tg-quote-name";
		quoteName.textContent = reply.name;

		const quoteText = document.createElement("span");
		quoteText.className = "tg-quote-text";
		quoteText.textContent = reply.text;

		quote.append(quoteName, quoteText);
		bubble.insertBefore(quote, body);
	}

	/* ---------------- 菜单动作 ---------------- */

	function runAction(action: string): void {
		const row = activeRow;
		closeMenu();
		if (!row) return;

		if (action === "copy") {
			// 用户在消息里选了一段文字时只复制选区；否则复制整条
			const selection = window.getSelection();
			const selected = selection?.toString() ?? "";
			const inRow =
				selection &&
				selection.rangeCount > 0 &&
				row.contains(selection.getRangeAt(0).commonAncestorContainer);
			const text = inRow && selected.trim() ? selected.trim() : copyOf(row);
			if (!text) return;
			void copyText(text).then((ok) => {
				if (ok) showToast(labels.copied);
			});
			return;
		}

		if (action === "reply") {
			startReply(row);
			return;
		}

		if (action === "retract") {
			retract(row);
		}
	}

	/* ---------------- 事件 ---------------- */

	const onContextMenu = (event: MouseEvent) => {
		const target = event.target as Element | null;
		const row = target?.closest<HTMLElement>(".tg-row");
		// 右键点空白处不拦截，保留浏览器自己的菜单
		if (!row || !scroller.contains(row)) return;
		event.preventDefault();
		closeMenu();
		openMenu(row, event.clientX, event.clientY);
	};

	const onMenuClick = (event: MouseEvent) => {
		const target = (event.target as Element | null)?.closest<HTMLElement>(
			"[data-ctx-action]",
		);
		if (!target) return;
		const action = target.dataset.ctxAction;
		if (action) runAction(action);
	};

	const onMenuKeydown = (event: KeyboardEvent) => {
		if (menu.hidden) return;
		const items = Array.from(
			menu.querySelectorAll<HTMLElement>("[data-ctx-action]"),
		).filter((item) => !item.closest("[hidden]"));
		if (items.length === 0) return;
		const index = items.indexOf(document.activeElement as HTMLElement);

		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			const step = event.key === "ArrowDown" ? 1 : -1;
			// 焦点可能还停在菜单本身（刚弹出时就是），此时 index 是 -1：
			// 往下进第一项，往上进最后一项
			const next =
				index < 0
					? step > 0
						? 0
						: items.length - 1
					: (index + step + items.length) % items.length;
			items[next]?.focus();
			return;
		}

		// Tab 不拦截默认行为：让焦点正常走到下一个元素，菜单顺手收起
		if (event.key === "Tab") {
			closeMenu();
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			closeMenu();
		}
	};

	const onDocumentPointerDown = (event: PointerEvent) => {
		if (menu.hidden) return;
		const target = event.target as Node | null;
		if (target && menu.contains(target)) return;
		closeMenu();
	};

	const onDocumentKeydown = (event: KeyboardEvent) => {
		if (event.key !== "Escape" || menu.hidden) return;
		// 菜单开着时 Esc 只关菜单：不让它继续冒到聊天页（那里会去关抽屉）
		event.stopImmediatePropagation();
		closeMenu();
	};

	const onScroll = () => closeMenu();
	const onResize = () => closeMenu();

	const onQuoteClick = (event: MouseEvent) => {
		const quote = (event.target as Element | null)?.closest<HTMLElement>(
			"[data-tg-quote-target]",
		);
		if (!quote) return;
		const id = quote.dataset.tgQuoteTarget;
		if (id) jumpTo(id);
	};

	/* 移动端长按：浏览器不会为普通文字派发 contextmenu，得自己计时 */
	const cancelLongPress = () => {
		window.clearTimeout(longPressTimer);
		longPressTimer = 0;
	};

	const onPointerDown = (event: PointerEvent) => {
		if (event.pointerType === "mouse") return;
		const row = (event.target as Element | null)?.closest<HTMLElement>(
			".tg-row",
		);
		if (!row) return;
		cancelLongPress();
		longPressStart = { x: event.clientX, y: event.clientY };
		longPressTimer = window.setTimeout(() => {
			longPressTimer = 0;
			closeMenu();
			openMenu(row, event.clientX, event.clientY);
		}, LONG_PRESS_MS);
	};

	const onPointerMove = (event: PointerEvent) => {
		if (!longPressTimer) return;
		const dx = event.clientX - longPressStart.x;
		const dy = event.clientY - longPressStart.y;
		if (Math.hypot(dx, dy) > LONG_PRESS_SLOP) cancelLongPress();
	};

	// 已经撤回过的消息：首屏进来就别显示（刷新、重进抽屉都一致）
	for (const row of Array.from(
		scroller.querySelectorAll<HTMLElement>(".tg-row"),
	)) {
		const id = row.dataset.tgMsg;
		if (id && retractedIds.has(id)) row.remove();
	}
	// 首屏被摘掉几条之后，留下的分组也要按新顺序重算，否则组尾的头像跟着丢了
	relayout();

	scroller.addEventListener("contextmenu", onContextMenu);
	scroller.addEventListener("pointerdown", onPointerDown);
	scroller.addEventListener("pointermove", onPointerMove);
	scroller.addEventListener("pointerup", cancelLongPress);
	scroller.addEventListener("pointercancel", cancelLongPress);
	scroller.addEventListener("click", onQuoteClick);
	scroller.addEventListener("scroll", onScroll, { passive: true });

	menu.addEventListener("click", onMenuClick);
	menu.addEventListener("keydown", onMenuKeydown);

	document.addEventListener("pointerdown", onDocumentPointerDown, true);
	document.addEventListener("keydown", onDocumentKeydown, true);
	window.addEventListener("resize", onResize);
	window.addEventListener("blur", closeMenu);

	chat
		.querySelector<HTMLElement>("[data-tg-reply-cancel]")
		?.addEventListener("click", () => clearReply());

	return {
		takePendingReply(): PendingReply | null {
			const reply = pending;
			clearReply();
			return reply;
		},
		decorate,
		relayout,
		registerRow(row: HTMLElement): void {
			// 走这条路的只有「自己发出去的」模板气泡：补齐 id 与方向，
			// 右键菜单才知道该用哪个名字（自己 → 当前身份）
			if (!row.dataset.tgSide) row.dataset.tgSide = "out";
			if (!row.dataset.tgMsg) {
				seq += 1;
				row.dataset.tgMsg = `msg-new-${Date.now()}-${seq}`;
			}
		},
		destroy(): void {
			cancelLongPress();
			window.clearTimeout(toastTimer);
			closeMenu();
			scroller.removeEventListener("contextmenu", onContextMenu);
			scroller.removeEventListener("pointerdown", onPointerDown);
			scroller.removeEventListener("pointermove", onPointerMove);
			scroller.removeEventListener("pointerup", cancelLongPress);
			scroller.removeEventListener("pointercancel", cancelLongPress);
			scroller.removeEventListener("click", onQuoteClick);
			scroller.removeEventListener("scroll", onScroll);
			menu.removeEventListener("click", onMenuClick);
			menu.removeEventListener("keydown", onMenuKeydown);
			document.removeEventListener("pointerdown", onDocumentPointerDown, true);
			document.removeEventListener("keydown", onDocumentKeydown, true);
			window.removeEventListener("resize", onResize);
			window.removeEventListener("blur", closeMenu);
		},
	};
}
