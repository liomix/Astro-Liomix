<script lang="ts">
import { onMount } from "svelte";
import type { EChartsType } from "echarts/core";

export let items: { name: string; count: number }[] = [];

// 红 → 紫 九色（色相 0°→275° 递进）
const PALETTE = [
	"#ef4444",
	"#f97316",
	"#f59e0b",
	"#84cc16",
	"#10b981",
	"#06b6d4",
	"#3b82f6",
	"#8b5cf6",
	"#a855f7",
];

let host: HTMLDivElement;
let chart: EChartsType | null = null;
let observer: MutationObserver | null = null;
let resizeObserver: ResizeObserver | null = null;
let disposed = false;

const isDark = () =>
	typeof document !== "undefined" &&
	document.documentElement.classList.contains("dark");

const labelColor = () => (isDark() ? "rgba(255,255,255,0.72)" : "#4b5563");

const buildOption = (width: number) => {
	// 小屏收窄半径，避免固定 150px 撑出画布
	const compact = width < 520;
	return {
		color: PALETTE,
		backgroundColor: "transparent",
		animationDuration: 600,
		textStyle: {
			fontFamily:
				host !== undefined
					? getComputedStyle(host).fontFamily
					: "ui-sans-serif, system-ui, sans-serif",
		},
		tooltip: {
			formatter: "{a} <br/>{b} : {c} ({d}%)",
		},
		legend: {
			icon: "circle",
			top: "bottom",
			itemWidth: 9,
			itemHeight: 9,
			itemGap: 14,
			textStyle: { color: labelColor(), fontSize: 12 },
		},
		series: [
			{
				name: "分类统计",
				type: "pie",
				radius: compact ? [26, 100] : [40, 150],
				center: ["50%", "48%"],
				roseType: "area",
				itemStyle: { borderRadius: 8 },
				label: {
					formatter: "{b} {c}",
					color: labelColor(),
					fontSize: compact ? 11 : 12,
				},
				labelLine: {
					length: 10,
					length2: 12,
					lineStyle: { width: 1, opacity: 0.55 },
				},
				emphasis: { scale: true, scaleSize: 5 },
				data: items.map((item) => ({ name: item.name, value: item.count })),
			},
		],
	};
};

const refreshTheme = () => {
	if (!chart) return;
	chart.setOption({
		legend: { textStyle: { color: labelColor() } },
		series: [{ label: { color: labelColor() } }],
	});
};

onMount(() => {
	let resizeTimer: ReturnType<typeof setTimeout> | undefined;

	const boot = async () => {
		const [core, charts, components, renderers] = await Promise.all([
			import("echarts/core"),
			import("echarts/charts"),
			import("echarts/components"),
			import("echarts/renderers"),
		]);
		if (disposed) return;

		core.use([
			charts.PieChart,
			components.TooltipComponent,
			components.LegendComponent,
			renderers.CanvasRenderer,
		]);

		chart = core.init(host, undefined, { renderer: "canvas" });
		chart.setOption(buildOption(host.clientWidth));

		// 主题切换只换文字色，避免整图重播动画
		observer = new MutationObserver(refreshTheme);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "data-theme"],
		});

		// 宽度变化跨过断点时重建，否则仅 resize
		let width = host.clientWidth;
		resizeObserver = new ResizeObserver(() => {
			if (!chart) return;
			const next = host.clientWidth;
			if (next === 0) return;
			const crossed = width < 520 !== next < 520;
			width = next;
			if (crossed) {
				chart.setOption(buildOption(next));
			} else {
				clearTimeout(resizeTimer);
				resizeTimer = setTimeout(() => chart?.resize(), 120);
			}
		});
		resizeObserver.observe(host);
	};

	boot();

	return () => {
		disposed = true;
		clearTimeout(resizeTimer);
		observer?.disconnect();
		resizeObserver?.disconnect();
		chart?.dispose();
		chart = null;
	};
});
</script>

<div class="cat-rose-chart card-base">
	<div class="cat-rose-canvas" bind:this={host}></div>
</div>

<style>
	.cat-rose-chart {
		position: relative;
		padding: 0.5rem 0.75rem 0;
		background:
			radial-gradient(
				120% 130% at 0% 0%,
				color-mix(in oklch, var(--primary) 10%, transparent),
				transparent 62%
			),
			var(--card-bg);
		border: 1px solid color-mix(in oklch, var(--primary) 12%, transparent);
	}

	.cat-rose-canvas {
		width: 100%;
		height: 400px;
	}

	@media (max-width: 767px) {
		.cat-rose-chart {
			padding: 0.25rem 0.5rem 0;
		}

		.cat-rose-canvas {
			height: 340px;
		}
	}
</style>
