export type SakuraConfig = {
	enable: boolean; // 是否启用樱花特效
	sakuraNum: number; // 樱花数量，默认21
	limitTimes: number; // 樱花越界限制次数，-1为无限循环
	size: {
		min: number; // 樱花最小尺寸倍数
		max: number; // 樱花最大尺寸倍数
	};
	opacity: {
		min: number; // 樱花最小不透明度
		max: number; // 樱花最大不透明度
	};
	speed: {
		horizontal: {
			min: number; // 水平移动速度最小值
			max: number; // 水平移动速度最大值
		};
		vertical: {
			min: number; // 垂直移动速度最小值
			max: number; // 垂直移动速度最大值
		};
		rotation: number; // 旋转速度
		fadeSpeed: number; // 消失速度，不应大于最小不透明度
	};
	zIndex: number; // 层级，确保樱花在合适的层级显示
};

// Spine 看板娘配置
export type SpineModelConfig = {
	enable: boolean; // 是否启用 Spine 看板娘
	model: {
		path: string; // 模型文件路径 (.json)
		scale?: number; // 模型缩放比例，默认1.0
		x?: number; // X轴偏移，默认0
		y?: number; // Y轴偏移，默认0
	};
	position: {
		corner: "bottom-left" | "bottom-right" | "top-left" | "top-right"; // 显示位置
		offsetX?: number; // 水平偏移量，默认20px
		offsetY?: number; // 垂直偏移量，默认20px
	};
	size: {
		width?: number; // 容器宽度，默认280px
		height?: number; // 容器高度，默认400px
	};
	interactive?: {
		enabled?: boolean; // 是否启用交互功能，默认true
		clickAnimations?: string[]; // 点击时随机播放的动画列表
		clickMessages?: string[]; // 点击时随机显示的文字消息
		messageDisplayTime?: number; // 文字显示时间（毫秒），默认3000
		idleAnimations?: string[]; // 待机动画列表
		idleInterval?: number; // 待机动画切换间隔（毫秒），默认10000
	};
	responsive?: {
		hideOnMobile?: boolean; // 是否在移动端隐藏，默认false
		mobileBreakpoint?: number; // 移动端断点，默认768px
	};
	zIndex?: number; // 层级，默认1000
	opacity?: number; // 透明度，0-1，默认1.0
};

// Live2D 看板娘配置 (使用 l2d-widget)
export type Live2DWidgetConfig = {
	enable: boolean; // 是否启用 Live2D 看板娘
	model:
		| { path: string; volume?: number; scale?: number; x?: number; y?: number }
		| {
				path: string;
				volume?: number;
				scale?: number;
				x?: number; // X轴偏移，范围 -2~2，正值向右
				y?: number; // Y轴偏移，范围 -2~2，正值向上
		  }[]; // 模型配置，支持单个或多个模型
	position?: "bottom-left" | "bottom-right"; // 显示位置，默认 "bottom-left"
	size?: number | { width: number; height: number }; // 画布尺寸（px），默认 300
	primaryColor?: string; // 主题色，用于菜单、状态条等 UI 元素
	transitionDuration?: number; // 入场/退场动画时长（ms），默认 1500
	transitionType?: "slide" | "fade"; // 入场/退场动画类型，默认 "slide"
	menus?: {
		items?: { icon?: string; label: string; action: string }[]; // 完全替换默认菜单项
		extraItems?: { icon?: string; label: string; action: string }[]; // 追加到默认菜单末尾
		align?: "left" | "right"; // 菜单对齐方式，默认 "right"
	};
	tips?: {
		enable?: boolean; // 气泡开关，默认 true
		welcomeMessage?: string[]; // 欢迎语
		messages?: string[]; // 循环提示内容
		duration?: number; // 每条提示展示时长（ms），默认 3000
		interval?: number; // 提示循环间隔（ms），默认 5000
		offset?: { x?: number; y?: number }; // 位置偏移量（px）
		typing?: {
			param?: string; // 嘴型参数名
			speed?: number; // 打字速度（ms/字），默认 100
			minValue?: number; // 嘴型开合最小值（0-1），默认 0.5
			maxValue?: number; // 嘴型开合最大值（0-1），默认 1
		};
	};
	responsive?: {
		hideOnMobile?: boolean; // 是否在移动端隐藏
		mobileBreakpoint?: number; // 移动端断点，默认 768
	};
};

/**
 * 樱花特效 Worker 通信消息类型
 *
 * 主线程 → Worker 的消息(通过 worker.postMessage 发送)
 */
export type SakuraWorkerInboundMessage =
	| {
			type: "init";
			config: SakuraConfig;
			/** 通过 transfer 转移给 Worker 的 OffscreenCanvas */
			canvas: OffscreenCanvas;
			width: number;
			height: number;
	  }
	| { type: "start" }
	| { type: "stop" }
	| { type: "resize"; width: number; height: number }
	| { type: "visibilitychange"; hidden: boolean };

/**
 * Worker → 主线程 的消息(通过 self.postMessage 发送)
 */
export type SakuraWorkerOutboundMessage =
	| {
			type: "ready";
	  }
	| {
			type: "error";
			message: string;
			stack?: string;
	  }
	| {
			type: "messageError";
			message: string;
	  };

/**
 * 主线程侧的 sakuraManager 接口契约
 *
 * Worker 模式与主线程回退模式都需实现该接口,
 * 确保 setting-utils.ts 和 DisplaySettingsIntegrated.svelte 无需感知底层实现。
 */
export interface SakuraManagerLike {
	config: SakuraConfig;
	isRunning: boolean;
	init: () => Promise<void>;
	stop: () => void;
	getIsRunning: () => boolean;
}

/**
 * 水波纹特效管理器接口契约
 *
 * WavesEffect.astro 中的主线程 Canvas 2D 管理器实现该接口,
 * 使初始化逻辑与具体实现解耦。
 */
export interface WavesManagerLike {
	isRunning: boolean;
	/** 挂载在 #header-waves 内的 canvas(供 Swup 切页后的防御性重校验使用) */
	canvas?: HTMLCanvasElement | null;
	init: () => Promise<void>;
	stop: () => void;
	getIsRunning: () => boolean;
}
