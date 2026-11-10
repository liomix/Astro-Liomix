/**
 * 设置面板组：齿轮按钮 → 设置菜单 → 主题设置 / 播放设置。
 *
 * 三个浮层共用一套「贴着右下角按钮、向上展开」的定位规则（原先只服务主题面板，
 * 这里抽出来给三块面板统一使用），
 * 并且同一时间只允许打开一块：从菜单进入子面板时先关掉菜单。
 *
 * 面板本身仍走 floating-panel-utils 的 .float-panel / .float-panel-closed 机制，
 * inert / aria-hidden / ESC 关闭都由那边负责，这里只负责开合与定位。
 */

export const SETTINGS_TRIGGER_ID = "settings-floating";

/** 菜单 + 两个子面板；打开其中一个会关掉其余 */
export const SETTINGS_PANEL_IDS = [
	"settings-menu",
	"display-setting",
	"playback-setting",
] as const;

export type SettingsPanelId = (typeof SETTINGS_PANEL_IDS)[number];

const CLOSED_CLASS = "float-panel-closed";
/** 面板与按钮之间的空隙、距离视口边缘的最小留白 */
const PANEL_GAP = 12;
const VIEWPORT_MARGIN = 8;

const observedPanels = new WeakSet<HTMLElement>();

function getPanel(id: string): HTMLElement | null {
	return document.getElementById(id);
}

function isPanelOpen(panel: HTMLElement): boolean {
	return !panel.classList.contains(CLOSED_CLASS);
}

/** 右边缘与按钮右边缘对齐，底边落在按钮上方，向上展开 */
function positionPanel(panel: HTMLElement): void {
	const trigger = getPanel(SETTINGS_TRIGGER_ID);
	if (!trigger) return;

	const rect = trigger.getBoundingClientRect();
	// 按钮被隐藏（收起/不可见）时保留上次位置，避免面板跳到左上角
	if (rect.width === 0 && rect.height === 0) return;

	const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
	const viewportHeight = window.innerHeight;

	panel.style.right = `${Math.max(VIEWPORT_MARGIN, viewportWidth - rect.right)}px`;
	panel.style.bottom = `${Math.max(
		VIEWPORT_MARGIN,
		viewportHeight - rect.top + PANEL_GAP,
	)}px`;
	panel.style.left = "auto";
	panel.style.top = "auto";

	// 面板高于按钮上方的可用空间时压缩高度（内容区自己滚动）
	const available = rect.top - PANEL_GAP - VIEWPORT_MARGIN * 2;
	panel.style.maxHeight = `${Math.max(
		160,
		Math.min(available, viewportHeight - VIEWPORT_MARGIN * 2),
	)}px`;
}

/** 按钮的选中态：任意设置面板打开时齿轮变成关闭图标 */
function syncTriggerState(): void {
	const trigger = getPanel(SETTINGS_TRIGGER_ID);
	if (!trigger) return;
	const anyOpen = SETTINGS_PANEL_IDS.some((id) => {
		const panel = getPanel(id);
		return panel ? isPanelOpen(panel) : false;
	});
	trigger.classList.toggle("toggled", anyOpen);
}

function observePanel(panel: HTMLElement): void {
	if (observedPanels.has(panel)) return;
	observedPanels.add(panel);
	// ESC / 点击外部由别的模块直接改 class，这里跟上按钮状态
	new MutationObserver(syncTriggerState).observe(panel, {
		attributes: true,
		attributeFilter: ["class"],
	});
}

function observePanels(): void {
	for (const id of SETTINGS_PANEL_IDS) {
		const panel = getPanel(id);
		if (panel) observePanel(panel);
	}
}

export function closeSettingsPanels(): void {
	for (const id of SETTINGS_PANEL_IDS) {
		getPanel(id)?.classList.add(CLOSED_CLASS);
	}
	syncTriggerState();
}

export function openSettingsPanel(id: SettingsPanelId): void {
	const panel = getPanel(id);
	if (!panel) return;

	for (const otherId of SETTINGS_PANEL_IDS) {
		if (otherId === id) continue;
		getPanel(otherId)?.classList.add(CLOSED_CLASS);
	}

	observePanel(panel);
	positionPanel(panel);
	panel.classList.remove(CLOSED_CLASS);
	syncTriggerState();
}

/** 齿轮按钮：任意面板打开时全部收起，否则拉出设置菜单 */
export function toggleSettingsMenu(): void {
	const anyOpen = SETTINGS_PANEL_IDS.some((id) => {
		const panel = getPanel(id);
		return panel ? isPanelOpen(panel) : false;
	});

	if (anyOpen) closeSettingsPanels();
	else openSettingsPanel("settings-menu");
}

type SettingsWindow = Window & {
	__settingsOpenPanel?: (id: SettingsPanelId) => void;
	__settingsTogglePanels?: () => void;
	__settingsPanelsInit?: boolean;
};

export function initSettingsPanels(): void {
	const settingsWindow = window as SettingsWindow;

	settingsWindow.__settingsOpenPanel = openSettingsPanel;
	settingsWindow.__settingsTogglePanels = toggleSettingsMenu;

	if (settingsWindow.__settingsPanelsInit) return;
	settingsWindow.__settingsPanelsInit = true;

	// 点击面板与按钮之外收起全部设置面板
	document.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof Node)) return;

		const trigger = getPanel(SETTINGS_TRIGGER_ID);
		if (trigger?.contains(target)) return; // 按钮自己负责开合

		for (const id of SETTINGS_PANEL_IDS) {
			if (getPanel(id)?.contains(target)) return; // 点在面板内部
		}

		closeSettingsPanels();
	});

	// 窗口尺寸/缩放变化时，已打开的面板跟着按钮重新贴合
	const repositionOpenPanels = () => {
		for (const id of SETTINGS_PANEL_IDS) {
			const panel = getPanel(id);
			if (panel && isPanelOpen(panel)) positionPanel(panel);
		}
	};
	window.addEventListener("resize", repositionOpenPanels, { passive: true });
	window.visualViewport?.addEventListener("resize", repositionOpenPanels, {
		passive: true,
	});

	observePanels();
	// Svelte 面板（client:load）可能在首次执行后才挂载，补几次观察
	window.addEventListener("astro:page-load", observePanels);
	document.addEventListener("swup:contentReplaced", observePanels);
	for (const delay of [300, 1500]) {
		window.setTimeout(observePanels, delay);
	}
}
