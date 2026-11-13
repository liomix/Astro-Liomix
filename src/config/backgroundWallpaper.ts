import type { BackgroundWallpaperConfig } from "@/types/backgroundWallpaper";

export const backgroundWallpaper: BackgroundWallpaperConfig = {
	// 壁纸模式："banner" 横幅壁纸，"fullscreen" 全屏壁纸，"overlay" 覆盖透明，"none" 纯色背景无壁纸
	mode: "fullscreen",
	// 是否启用背景视频播放，配置后将在导航栏显示视频播放按钮
	playerEnable: true,
	/**
	 * 背景图片配置
	 *
	 * 本站已清空主题自带的示例壁纸（d1–d6 / m1–m6 与 alan-mikasa 已删除），
	 * 现在只用自定义壁纸：`website-bg-1.png`（3240×1821 原图），桌面端与移动端共用这一张。
	 *
	 * 关于清晰度：壁纸的编码质量与响应式宽度由下面的 imageQuality / imageWidths 单独控制，
	 * 不走站点全局的 quality: 85 —— 满屏线稿用 q85 会把草和树的纹理压糊，
	 * 且宽度上限若停在 1920，2 倍屏就只能放大显示。现在最大一档直接给到原图 3240。
	 *
	 * 路径支持三种写法：
	 *   1. src 目录（不以 "/" 开头，走 Astro 图片优化，推荐）："assets/images/DesktopWallpaper/website-bg-1.png"
	 *   2. public 目录（以 "/" 开头，原样输出不优化）："/assets/images/banner.avif"
	 *   3. 远程 URL（不优化，体积要小）："https://t.alcy.cc/pc"
	 *
	 * 单张直接用字符串；多张写成数组，每次刷新随机取一张：
	 * desktop: [
	 *   "assets/images/DesktopWallpaper/website-bg-1.png",
	 *   "assets/images/DesktopWallpaper/website-bg-2.png",
	 * ],
	 */
	src: {
		// 桌面背景图片（3240×1821 原图，多张时改成数组，每次刷新随机一张）
		desktop: "assets/images/DesktopWallpaper/website-bg-1.png",
		// 移动背景图片：暂时共用桌面这张（竖屏下 object-cover 裁成中间一竖条）。
		// 以后有了竖图：放进 src/assets/images/MobileWallpaper/，把这行指过去即可。
		mobile: "assets/images/DesktopWallpaper/website-bg-1.png",
		// 背景视频播放地址
		// 支持单个视频路径（字符串）或多个视频循环（数组，参考上面壁纸配置）
		// 支持远程视频URL，本地视频请放在 public/assets/videos/ 目录下
		// playerUrl: "/assets/videos/firefly.mp4",
		playerUrl: "https://bed.twoleaf.cn/file/1785658612716_firefly.mp4",
	},
	// 壁纸专用的输出设置（不影响正文 / 封面图，那些仍走 siteConfig 的 quality: 85）
	// 壁纸是满屏铺满的线稿画面，q85 会把草和树的纹理压成一团；同时宽度上限要放到原图尺寸，
	// 否则 2 倍屏（DPR 2）只能拿到 1920 再放大，糊是必然的。
	imageQuality: 92,
	imageWidths: [1280, 1920, 2560, 3240],
	// 横幅壁纸和全屏壁纸共享配置
	common: {
		// 壁纸遮罩暗度，让横幅文字显示更清晰，0-1之间，值越大越暗
		// 全屏 hero 下壁纸本身就是视觉主体，标题文字已带阴影，遮罩设为 0 保持画面原色
		dimOpacity: 0,
		// 多视频播放模式："order" 顺序循环，"random" 随机切换（仅当 playerUrl 为数组时生效）
		playerMode: "random",
		// 主页横幅文字
		homeText: {
			// 是否启用主页横幅文字
			enable: true,
			// 主页横幅主标题
			title: "写在时间之内",
			// 主页横幅主标题字体大小
			titleSize: "4.5rem",
			// 主页横幅副标题（打字机开启时按数组顺序循环打字）
			subtitle: ["时间之外", "我们的星星"],
			// 主页横幅副标题字体大小
			subtitleSize: "1.5rem",
			typewriter: {
				// 是否启用打字机效果
				// 打字机开启 → 循环显示所有副标题
				// 打字机关闭 → 每次刷新随机显示一条副标题
				enable: true,
				// 打字速度（毫秒）：中文按 180ms/字，五字短句约 0.9 秒打完，不慌不忙
				speed: 180,
				// 删除速度（毫秒）
				deleteSpeed: 90,
				// 完全显示后的暂停时间（毫秒）
				pauseTime: 2600,
			},
			// 是否显示标题下方的链接图标（关闭后 links 配置不生效，保留仅为方便以后恢复）
			linksEnable: false,
			// 首页横幅标题下方的链接图标（可选，支持 showName 显示文字）
			// 图标支持 Iconify 格式：fa7-brands:github、fa7-solid:envelope、mdi:rss 等
			links: [
				{
					name: "GitHub",
					icon: "fa7-brands:github",
					url: "https://github.com/CuteLeaf/Firefly",
					showName: true,
				},
				{
					name: "Email",
					icon: "fa7-solid:envelope",
					url: "mailto:xiaye@msn.com",
				},
				{
					name: "Sponsor",
					icon: "material-symbols:favorite",
					url: "https://blog.cuteleaf.cn/sponsor/",
				},
				{
					name: "RSS",
					icon: "fa7-solid:rss",
					url: "/rss/",
				},
			],
		},
		// 壁纸轮播配置，横幅壁纸和全屏壁纸共享，仅在配置多张图片时生效
		carousel: {
			// 是否启用壁纸轮播；关闭时保持每次刷新随机显示一张
			enable: false,
			// 轮播切换间隔（毫秒）
			interval: 5000,
			// 过渡效果: 'fade' 渐变 | 'zoom' 缩放 | 'slide' 滑动 | 'kenburns' 旋转木马
			transitionEffect: "zoom",
		},
		// 水波纹动画效果配置，开启会影响页面性能，增加内存占用，请根据自己的喜好开启
		waves: {
			enable: {
				// 桌面端是否启用水波纹动画效果
				desktop: true,
				// 移动端是否启用水波纹动画效果
				mobile: true,
			},
		},
		// 渐变过渡效果配置，当水波纹关闭时自动启用，提供壁纸底部到背景色的平滑过渡
		gradient: {
			enable: {
				// 桌面端是否启用渐变过渡
				desktop: true,
				// 移动端是否启用渐变过渡
				mobile: true,
			},
			// 渐变高度
			height: "10%",
		},
	},
	// Banner模式特有配置
	banner: {
		// 图片位置
		// 支持所有CSS object-position值，如: 'top', 'center', 'bottom', 'left top', 'right bottom', '25% 75%', '10px 20px'..
		// 如果不知道怎么配置百分百之类的配置，推荐直接使用：'center'居中，'top'顶部居中，'bottom' 底部居中，'left'左侧居中，'right'右侧居中
		position: "0% 20%",
		// 文章横幅信息："description" 显示描述，"meta" 显示日期、字数和阅读时长
		postInfo: {
			mode: "description",
		},
		// 导航栏配置
		navbar: {
			// 导航栏透明模式："semi" 半透明，"semifull" 动态透明，"none" 纯色不透明
			// 默认 semifull：顶部悬在横幅上完全透明（文字反白），下滑后玻璃化
			transparentMode: "semifull",
			// 毛玻璃模糊度，0 即关闭导航栏的毛玻璃
			// 注意：导航栏子菜单与浮动面板始终保留毛玻璃，模糊度跟随此项但有最小值
			blur: 12,
		},
	},
	// 覆盖透明覆盖模式特有配置
	overlay: {
		// 层级，确保壁纸在背景层
		zIndex: -1,
		// 壁纸透明度
		opacity: 0.8,
		// 背景透明度，0-1之间：1 = 完全透明（清晰），0 = 最大模糊
		// 换算关系：blur = (1 - transparency) * 20px，0.5 即原来的 blur(10px)
		transparency: 0.5,
		// 卡片透明度，0-1之间，值越小越透明
		cardOpacity: 0.6,
		// 弹窗（设置 / 搜索 / 翻译等浮动面板）透明度，0-1之间：
		// 1 = 完全透明，0 = 完全不透明（内部换算成 --panel-transparent-opacity 的 alpha）
		// 只在透明模式下生效；0.4 即 alpha 0.6，与卡片的默认观感一致
		panelTransparency: 0.4,
	},
	// 全屏壁纸模式特有配置
	// 背景透明度(transparency)、卡片透明度(cardOpacity)、层级(zIndex) 复用上方 overlay 模式的配置；
	// 背景透明度(opacity)不适用（全屏壁纸不透明）；导航栏透明模式由 fullscreen.navbar.transparentMode 控制，脱离 banner 的 navbar 配置
	fullscreen: {
		// 布局模式："classic" 经典文档流全屏壁纸，"hero" 固定全屏首屏壁纸
		layout: "hero",
		// 图片位置
		position: "center",
		// 全屏壁纸模式的导航栏配置
		navbar: {
			// 导航栏透明模式："semi" 半透明，"semifull" 动态透明（仅首页顶部透明、下滑玻璃化；非首页均跟卡片半透明）
			transparentMode: "semifull",
			// 导航栏毛玻璃模糊度，0 即关闭（玻璃态生效）
			blur: 12,
		},
		// 首页下滑时壁纸模糊渐变开关（从 0 渐变为 overlay.transparency 换算出的最大模糊）
		// 关闭后该设备上全屏壁纸保持清晰（首页与非首页都不模糊），设置面板的模糊度滑块也会隐藏
		blurRamp: {
			enable: {
				// 桌面端是否启用模糊渐变
				desktop: true,
				// 移动端是否启用模糊渐变
				mobile: true,
			},
		},
	},
};
