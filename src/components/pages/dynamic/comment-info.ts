/**
 * CommentInfoPop：评论信息弹窗（昵称 / 邮箱 / 头像）
 * ---------------------------------------------------------------------------
 * 顶栏整块和输入栏上的遮罩都是入口（`[data-ci-open]`），点开弹出这个弹窗：
 *   - 昵称、邮箱写进 localStorage（comment-user.ts）；
 *   - 头像不单独存，永远由「邮箱 + 昵称」现算：QQ 邮箱取 QQ 号拉 qlogo 头像，
 *     其余（含非 QQ 邮箱、QQ 邮箱设了英文别名）用昵称首字；
 *   - 身份没填完整时输入栏被一层遮罩盖住（`.tg-composer-lock`），点它回到这个弹窗。
 *
 * 所有 DOM 都在同一个 iframe 文档里，不需要任何跨文档通信；文案由 SSR 按当前语言
 * 写进根元素的 data-*，客户端不重复引一套 i18n。
 */
import {
	avatarUrlOf,
	COMMENT_EMAIL_MAX,
	COMMENT_NAME_MAX,
	getCommentUser,
	initialOf,
	isValidEmail,
	isValidName,
	qqAvatarFallbackUrl,
	qqFromEmail,
	setCommentUser,
	type CommentUser,
} from "@/components/pages/dynamic/comment-user";

/**
 * 把头像画进一个「头像盒」：盒子里固定是
 *   <img data-avatar-img hidden> + <span data-avatar-initial>
 * 有 QQ 头像就把图顶上来（data-has-image="true"），没有 / 加载失败就留着首字。
 *
 * 图没到之前一直显示首字，不能先设 true —— 否则会空着一个圆等网络。
 */
function paintAvatar(
	box: HTMLElement | null,
	user: CommentUser | null,
): void {
	if (!box) return;

	const img = box.querySelector<HTMLImageElement>("[data-avatar-img]");
	const initial = box.querySelector<HTMLElement>("[data-avatar-initial]");
	if (initial) initial.textContent = initialOf(user?.name ?? "");
	if (!img) return;

	const url = avatarUrlOf(user);
	if (!url) {
		img.hidden = true;
		img.removeAttribute("src");
		delete img.dataset.src;
		box.dataset.hasImage = "false";
		return;
	}

	// 同一张图不重复请求：输入邮箱时每敲一个字都会走到这里
	if (img.dataset.src === url && !img.hidden) return;

	const qq = user?.email ? qqFromEmail(user.email) : null;

	img.dataset.src = url;
	delete img.dataset.fallback;
	img.hidden = false;
	img.onload = () => {
		if (box.dataset.hasImage !== "true") box.dataset.hasImage = "true";
	};
	// QQ 号不存在、对方设了隐私、或者干脆断网：先换 qlogo 的备用入口试一次，
	// 还是不行才退回昵称首字 —— 不要留一个破图挂在圆里
	img.onerror = () => {
		if (qq && img.dataset.fallback !== "true") {
			img.dataset.fallback = "true";
			img.src = qqAvatarFallbackUrl(qq);
			return;
		}
		img.hidden = true;
		img.removeAttribute("src");
		delete img.dataset.src;
		box.dataset.hasImage = "false";
	};
	img.src = url;
}

export function initCommentInfo(chat: HTMLElement): void {
	const pop = chat.querySelector<HTMLElement>("[data-ci-pop]");
	if (!pop || chat.dataset.ciBound === "true") return;
	chat.dataset.ciBound = "true";

	const nameInput = pop.querySelector<HTMLInputElement>("[data-ci-name]");
	const emailInput = pop.querySelector<HTMLInputElement>("[data-ci-email]");
	const error = pop.querySelector<HTMLElement>("[data-ci-error]");
	const popAvatar = pop.querySelector<HTMLElement>("[data-ci-avatar]");
	const headAvatar = chat.querySelector<HTMLElement>("[data-ci-head-avatar]");
	const headName = chat.querySelector<HTMLElement>("[data-ci-head-name]");
	const headSub = chat.querySelector<HTMLElement>("[data-ci-head-sub]");
	const input = chat.querySelector<HTMLTextAreaElement>("[data-tg-input]");

	// 文案：SSR 按当前语言写进 data-*
	const subEmpty = chat.dataset.tgCiSubEmpty || "";
	const nameRequired = chat.dataset.tgCiNameRequired || "Name is required";
	const emailInvalid = chat.dataset.tgCiEmailInvalid || "Invalid email";

	/**
	 * 默认身份 = 站点配置里的昵称 + Email 链接。
	 * 没设置过的访客看到的是这两条，而不是一片空白 —— 点开弹窗就是预填好的，
	 * 改成自己的再保存。只要没保存过，输入栏就是锁着的（见 applyIdentity）。
	 */
	const defaults: CommentUser = {
		name: (chat.dataset.tgDefaultName || "").slice(0, COMMENT_NAME_MAX),
		email: (chat.dataset.tgDefaultEmail || "").slice(0, COMMENT_EMAIL_MAX),
	};

	/** 打开弹窗的那个元素：关闭时把焦点还给它 */
	let opener: HTMLElement | null = null;

	const showError = (text: string) => {
		if (!error) return;
		error.textContent = text;
		error.hidden = false;
	};

	const hideError = () => {
		if (!error) return;
		error.hidden = true;
		error.textContent = "";
	};

	/**
	 * 把身份铺到界面上：顶栏（头像 / 昵称 / 邮箱）＋ 输入栏开关。
	 * ready 只看「有没有保存过」，不是「字段看着像不像」——
	 * 默认值虽然填好了，但没点过保存就仍然算没设置。
	 */
	const applyIdentity = (user: CommentUser | null, ready: boolean): void => {
		const name = user?.name.trim() || "";
		const email = user?.email.trim() || "";

		if (headName) headName.textContent = name || defaults.name || "?";
		if (headSub) headSub.textContent = email || (ready ? "" : subEmpty);
		paintAvatar(headAvatar, user);

		chat.dataset.identityReady = ready ? "true" : "false";
		if (input) input.disabled = !ready;
	};

	const open = (trigger: HTMLElement): void => {
		if (!pop.hidden) return;
		opener = trigger;

		const current = getCommentUser() ?? defaults;
		if (nameInput) nameInput.value = current.name;
		if (emailInput) emailInput.value = current.email;
		paintAvatar(popAvatar, current);
		hideError();

		pop.hidden = false;
		chat.dataset.ciPop = "open";

		// 焦点落在最该改的那一栏：没昵称先改昵称，邮箱不合法改邮箱，
		// 两条都齐了就把昵称全选，方便直接覆盖
		requestAnimationFrame(() => {
			if (!isValidName(current.name)) nameInput?.focus();
			else if (!isValidEmail(current.email)) emailInput?.focus();
			else nameInput?.select();
		});
	};

	const close = (): void => {
		if (pop.hidden) return;
		pop.hidden = true;
		chat.dataset.ciPop = "closed";
		const back = opener;
		opener = null;
		back?.focus({ preventScroll: true });
	};

	const save = (): void => {
		const name = (nameInput?.value ?? "").trim();
		const email = (emailInput?.value ?? "").trim();

		if (!isValidName(name)) {
			showError(nameRequired);
			nameInput?.focus();
			return;
		}
		if (!isValidEmail(email)) {
			showError(emailInvalid);
			emailInput?.focus();
			return;
		}

		const user: CommentUser = { name, email };
		setCommentUser(user);
		applyIdentity(user, true);
		close();
		// 填身份的目的就是说话，保存完顺手把光标送进输入框
		input?.focus({ preventScroll: true });
	};

	// 入口：顶栏身份区 + 输入栏遮罩，用委托，省得给两个按钮各绑一次
	chat.addEventListener("click", (event) => {
		const target = event.target as Element | null;
		if (!target) return;

		const trigger = target.closest<HTMLElement>("[data-ci-open]");
		if (trigger) {
			event.preventDefault();
			open(trigger);
			return;
		}

		if (
			target.closest("[data-ci-mask]") ||
			target.closest("[data-ci-close]") ||
			target.closest("[data-ci-cancel]")
		) {
			event.preventDefault();
			close();
		}
	});

	pop.querySelector("[data-ci-save]")?.addEventListener("click", save);

	// 弹窗里按 Enter = 保存（两个输入框都适用；Esc 见下面的 document 监听）
	pop.addEventListener("keydown", (event) => {
		if (event.key !== "Enter") return;
		event.preventDefault();
		save();
	});

	// 邮箱一边敲一边换头像预览：只有格式合法时才去算 QQ 号，避免半截地址也发请求
	const preview = () => {
		const email = (emailInput?.value ?? "").trim();
		paintAvatar(popAvatar, {
			name: nameInput?.value ?? "",
			email: isValidEmail(email) ? email : "",
		});
		hideError();
	};
	nameInput?.addEventListener("input", preview);
	emailInput?.addEventListener("input", preview);

	/**
	 * Esc 先关弹窗。
	 * 用捕获阶段并 stopPropagation：TelegramChat 自己也监听 Esc（先收表情面板、
	 * 再让父窗口收抽屉），不拦住的话按一下会连抽屉一起关掉。
	 */
	document.addEventListener(
		"keydown",
		(event) => {
			if (event.key !== "Escape" || pop.hidden) return;
			event.preventDefault();
			event.stopPropagation();
			close();
		},
		true,
	);

	// 初始状态：存过身份就用存的，没存过就把站点默认值摆在顶栏上、输入栏锁住
	const stored = getCommentUser();
	applyIdentity(stored ?? defaults, Boolean(stored));
}
