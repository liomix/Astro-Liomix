<script lang="ts">
/**
 * 列表卡片的骨架屏（Svelte 版）
 * ---------------------------------------------------------------------------
 * 动态流、搜索结果这些「一屏好几张卡片」的地方，加载时先画出卡片的形状：
 * 头像 + 昵称/时间 + 两三行正文 + 底部动作条。数据回来是替换而不是重排。
 *
 * 为什么是 .svelte 而不是 .astro：三个调用方（动态流、两个搜索面板）都是
 * Svelte 岛，.astro 组件只能经 Astro 渲染，塞不进岛里。骨架块本身用全局的
 * `skeleton` 类（styles/components/skeleton.css），和 Astro 那边的
 * Skeleton.astro 是同一套视觉。
 */
interface Props {
	/** 画几张；默认 2 张够占住首屏 */
	rows?: number;
	/** card：整张卡片（动态流）；compact：一行一项（搜索下拉） */
	variant?: "card" | "compact";
	/** 读屏软件念的话（视觉上是骨架） */
	label?: string;
}

let { rows = 2, variant = "card", label = "加载中…" }: Props = $props();

const count = $derived(Math.max(1, Math.min(6, rows)));
</script>

<div
	class="card-skeleton"
	class:card-skeleton--compact={variant === "compact"}
	role="status"
	aria-live="polite"
>
	<span class="card-skeleton__sr">{label}</span>
	{#each Array.from({ length: count }) as _, index (index)}
		{#if variant === "compact"}
			<div class="card-skeleton__row">
				<span
					class="skeleton skeleton--circle"
					style="--skeleton-width:1.75rem;--skeleton-height:1.75rem"
				></span>
				<span
					class="skeleton"
					style="--skeleton-width:{index % 2 === 0 ? '70%' : '54%'};--skeleton-height:.7rem"
				></span>
			</div>
		{:else}
			<div class="card-skeleton__card card-base">
				<div class="card-skeleton__head">
					<span
						class="skeleton skeleton--circle"
						style="--skeleton-width:2.5rem;--skeleton-height:2.5rem"
					></span>
					<div class="card-skeleton__who">
						<span
							class="skeleton"
							style="--skeleton-width:7rem;--skeleton-height:.8rem"
						></span>
						<span
							class="skeleton"
							style="--skeleton-width:4.5rem;--skeleton-height:.6rem"
						></span>
					</div>
				</div>
				<div class="card-skeleton__body">
					<span
						class="skeleton"
						style="--skeleton-width:100%;--skeleton-height:.75rem"
					></span>
					<span
						class="skeleton"
						style="--skeleton-width:88%;--skeleton-height:.75rem"
					></span>
					<span
						class="skeleton"
						style="--skeleton-width:62%;--skeleton-height:.75rem"
					></span>
				</div>
				<div class="card-skeleton__actions">
					<span
						class="skeleton"
						style="--skeleton-width:3.4rem;--skeleton-height:1.5rem;--skeleton-radius:9999px"
					></span>
					<span
						class="skeleton"
						style="--skeleton-width:3.4rem;--skeleton-height:1.5rem;--skeleton-radius:9999px"
					></span>
				</div>
			</div>
		{/if}
	{/each}
</div>

<style>
	.card-skeleton {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		width: 100%;
	}

	.card-skeleton__sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.card-skeleton__card {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1.1rem 1.15rem;
	}

	.card-skeleton__head {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.card-skeleton__who {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.card-skeleton__body {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding-top: 0.15rem;
	}

	.card-skeleton__actions {
		display: flex;
		gap: 0.5rem;
		padding-top: 0.35rem;
	}

	/* 搜索下拉里的一行：图标位 + 一条文字 */
	.card-skeleton__row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.35rem 0.1rem;
	}
</style>
