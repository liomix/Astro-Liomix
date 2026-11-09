<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import {
	DARK_MODE,
	LIGHT_MODE,
	SCHEDULED_MODE,
	SYSTEM_MODE,
} from "@/constants/constants";
import type { LIGHT_DARK_MODE } from "@/types/config.ts";
import {
	getStoredTheme,
	resolveTheme,
	setTheme,
} from "@/utils/setting-utils";

// 导航栏图标只做「点一下就切换」：日间 ⇄ 夜间。
// 更细的模式（跟随系统、定时）在主题弹窗的「背景」里设置。

// 存储的模式（可能是 system / scheduled）
let mode = $state<LIGHT_DARK_MODE>(LIGHT_MODE);
// 实际生效的模式，决定显示太阳还是月亮
let displayedMode = $state<LIGHT_DARK_MODE>(LIGHT_MODE);

function updateDisplayedMode() {
	displayedMode = resolveTheme(mode);
}

function toggleScheme() {
	// 跟随系统/定时属于「自动」状态，点击后直接锁定到当前的对立面
	const nextMode = displayedMode === DARK_MODE ? LIGHT_MODE : DARK_MODE;
	mode = nextMode;
	setTheme(nextMode);
	updateDisplayedMode();
}

onMount(() => {
	mode = getStoredTheme();
	updateDisplayedMode();

	// 其他入口（主题弹窗）改了主题时同步图标
	const handleThemeChange = () => {
		mode = getStoredTheme();
		updateDisplayedMode();
	};
	window.addEventListener("theme-change", handleThemeChange);

	// system / scheduled 模式下，实际生效的主题会自己变，图标要跟着变
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
	const handleSystemChange = () => {
		if (mode === SYSTEM_MODE || mode === SCHEDULED_MODE) updateDisplayedMode();
	};
	mediaQuery.addEventListener("change", handleSystemChange);

	return () => {
		window.removeEventListener("theme-change", handleThemeChange);
		mediaQuery.removeEventListener("change", handleSystemChange);
	};
});
</script>

<button
	aria-label={`${i18n(I18nKey.lightMode)} / ${i18n(I18nKey.darkMode)}`}
	class="relative nav-icon-btn"
	id="scheme-switch"
	onclick={toggleScheme}
>
	<div
		class="absolute inset-0 flex items-center justify-center"
		class:opacity-0={displayedMode !== LIGHT_MODE}
	>
		<Icon icon="material-symbols:wb-sunny-outline-rounded" class="text-[1.25rem]"></Icon>
	</div>
	<div
		class="absolute inset-0 flex items-center justify-center"
		class:opacity-0={displayedMode !== DARK_MODE}
	>
		<Icon icon="material-symbols:dark-mode-outline-rounded" class="text-[1.25rem]"></Icon>
	</div>
</button>
