// 分层边界（规范 §3.7）。依赖方向：pages → layouts → features → shared，只能向下。
// 装好依赖后由 `pnpm deps:check`（depcruise src --config .dependency-cruiser.cjs）执行，CI 里是阻断项。
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		{
			name: "shared-must-not-know-features",
			severity: "error",
			comment: "shared 是地基，不许反向依赖业务域",
			from: { path: "^src/shared/" },
			to: { path: "^src/features/" },
		},
		{
			name: "features-must-not-know-each-other",
			severity: "error",
			comment: "域间只走公开出口，且要登记（docs/adr/0001 偏离表）",
			from: { path: "^src/features/([^/]+)/" },
			to: { path: "^src/features/(?!$1)([^/]+)/" },
		},
		{
			name: "features-must-not-know-pages",
			severity: "error",
			comment: "反向依赖：pages 是消费方",
			from: { path: "^src/(features|shared)/" },
			to: { path: "^src/(pages|layouts)/" },
		},
		{
			name: "no-deep-import-into-features",
			severity: "error",
			comment: "对外只认 features/<域>/index.ts 与 features/<父>/<子>/index.ts，请从 @/features/<域> 导入",
			from: { pathNot: "^src/features/([^/]+)/" },
			to: { path: "^src/features/[^/]+/(?!([^/]+/)?index\\.ts$)" },
		},
		{
			name: "plugins-must-stay-pure",
			severity: "error",
			comment: "remark/rehype 插件不得碰 Astro 运行时与 DOM",
			from: { path: "^src/plugins/" },
			to: { path: "^(node:|astro:|svelte|@astrojs/)" },
		},
	],
	options: {
		doNotFollow: { path: "node_modules" },
		tsConfig: { fileName: "tsconfig.json" },
		enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require"] },
	},
};
