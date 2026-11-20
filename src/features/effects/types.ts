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
