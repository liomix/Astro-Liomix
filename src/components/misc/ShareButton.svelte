<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import I18nKey from "../../i18n/i18nKey";
import { i18n } from "../../i18n/translation";

export let title: string;
export let author: string;
export let description = "";
export let pubDate: string;
export let coverImage: string | null = null;
export let coverImageSelector: string | null = null;
export let url: string;
export let avatar: string | null = null;
export let avatarSelector: string | null = null;

let showModal = false;
let posterImage: string | null = null;
let generating = false;
let themeColor = "#558e88"; // Default blue
// 海报主文字色（标题、作者名共用）
const POSTER_INK = "#0f172a";

onMount(() => {
	// Get theme color from CSS variable
	const temp = document.createElement("div");
	temp.style.color = "var(--primary)";
	temp.style.display = "none";
	document.body.appendChild(temp);
	const computedColor = getComputedStyle(temp).color;
	document.body.removeChild(temp);

	if (computedColor) {
		themeColor = computedColor;
	}
});

function loadImage(src: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => {
			if (!src.includes("images.weserv.nl")) {
				const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(src)}&output=png`;
				const proxyImg = new Image();
				proxyImg.crossOrigin = "anonymous";
				proxyImg.onload = () => resolve(proxyImg);
				proxyImg.onerror = () => {
					resolve(null);
				};
				proxyImg.src = proxyUrl;
			} else {
				resolve(null);
			}
		};
		img.src = src;
	});
}

function resolveImageSource(
	src: string | null,
	selector: string | null,
): string | null {
	if (!selector) return src;
	const image = document.querySelector<HTMLImageElement>(selector);
	return image?.currentSrc || image?.src || src;
}

// 逐字扫描会把英文单词从中间劈开，这里先切成「拉丁词 / 空白 / 单个非拉丁字符」，
// 再逐块量宽：中文按字断行、英文按词断行，超长 token（链接等）回退成逐字断开
function getLines(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
): string[] {
	const units =
		text.match(/[A-Za-z0-9@#%&$^*_+.,:;!?'"()\/[\]{}|<>\\=~`-]+|\s+|[\s\S]/g) ?? [];
	const lines: string[] = [];
	let line = "";

	for (const unit of units) {
		if (line === "" && ctx.measureText(unit).width > maxWidth) {
			// 单个 token 就超过行宽：只能逐字硬断
			let chunk = "";
			for (const ch of Array.from(unit)) {
				if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
					lines.push(chunk);
					chunk = ch;
				} else {
					chunk += ch;
				}
			}
			line = chunk;
			continue;
		}

		if (ctx.measureText(line + unit).width <= maxWidth) {
			line += unit;
		} else {
			if (line.trim()) lines.push(line.trimEnd());
			line = unit.replace(/^\s+/, "");
		}
	}
	if (line.trim()) lines.push(line.trimEnd());
	return lines;
}

function fitText(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
): string {
	if (ctx.measureText(text).width <= maxWidth) return text;

	const ellipsis = "...";
	const fittedChars = Array.from(text);
	while (
		fittedChars.length > 0 &&
		ctx.measureText(`${fittedChars.join("")}${ellipsis}`).width > maxWidth
	) {
		fittedChars.pop();
	}

	return fittedChars.length > 0
		? `${fittedChars.join("")}${ellipsis}`
		: ellipsis;
}

function drawRoundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
) {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}

function ellipsize(
	ctx: CanvasRenderingContext2D,
	line: string,
	maxWidth: number,
): string {
	if (ctx.measureText(`${line}…`).width <= maxWidth) return `${line}…`;
	const chars = Array.from(line);
	while (chars.length > 0 && ctx.measureText(`${chars.join("")}…`).width > maxWidth)
		chars.pop();
	return chars.length ? `${chars.join("")}…` : "…";
}

// 行数封顶：超出的行整段丢掉，最后一行补省略号
function clampLines(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
	maxLines: number,
): string[] {
	const lines = getLines(ctx, text, maxWidth);
	if (lines.length <= maxLines) return lines;
	const kept = lines.slice(0, maxLines);
	kept[kept.length - 1] = ellipsize(ctx, kept[kept.length - 1], maxWidth);
	return kept;
}

// getComputedStyle 拿到的是 rgb()/rgba()，拼半透明色需要自己拆分量
function withAlpha(color: string, alpha: number): string {
	const rgb = color.match(/rgba?\(([^)]+)\)/);
	if (rgb) {
		const [r, g, b] = rgb[1].split(",").map((n) => Number.parseFloat(n));
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}
	const hex = color.replace("#", "");
	const full =
		hex.length === 3
			? hex
					.split("")
					.map((c) => c + c)
					.join("")
			: hex;
	if (full.length === 6) {
		const r = Number.parseInt(full.slice(0, 2), 16);
		const g = Number.parseInt(full.slice(2, 4), 16);
		const b = Number.parseInt(full.slice(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}
	return color;
}

// letterSpacing 仅较新浏览器支持，不支持时赋值会被忽略，不会影响布局
function setTracking(ctx: CanvasRenderingContext2D, value: number) {
	(ctx as unknown as { letterSpacing?: string }).letterSpacing = `${value}px`;
}

async function generatePoster() {
	showModal = true;
	if (posterImage) return;

	generating = true;
	try {
		// 按需加载 qrcode（仅生成分享海报时才需要），避免拖慢每篇博文的首屏 JS
		const { default: QRCode } = await import("qrcode");
		const scale = 2;
		const px = (n: number) => n * scale;
		const W = px(400);
		const PAD = px(26);
		const RADIUS = px(22);
		const contentW = W - PAD * 2;
		const FONT =
			'-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';
		const setFont = (
			c: CanvasRenderingContext2D,
			weight: number,
			size: number,
		) => {
			c.font = `${weight} ${px(size)}px ${FONT}`;
		};

		const qrCard = px(60);
		const qrInner = px(48);

		// 1. Prepare resources
		const qrCodeUrl = await QRCode.toDataURL(url, {
			margin: 0,
			width: qrInner * 2,
			color: { dark: POSTER_INK, light: "#ffffff" },
		});
		const resolvedCoverImage = resolveImageSource(
			coverImage,
			coverImageSelector,
		);
		const resolvedAvatar = resolveImageSource(avatar, avatarSelector);
		const [qrImg, coverImg, avatarImg] = await Promise.all([
			loadImage(qrCodeUrl),
			resolvedCoverImage
				? loadImage(resolvedCoverImage)
				: Promise.resolve(null),
			resolvedAvatar ? loadImage(resolvedAvatar) : Promise.resolve(null),
		]);

		// 日期不进页眉，改做标题上方的 kicker；取不到合法日期就整块不画
		let dateText = "";
		const pubDateObj = new Date(pubDate);
		if (!Number.isNaN(pubDateObj.getTime())) {
			const mm = `${pubDateObj.getMonth() + 1}`.padStart(2, "0");
			const dd = `${pubDateObj.getDate()}`.padStart(2, "0");
			dateText = `${pubDateObj.getFullYear()}.${mm}.${dd}`;
		}

		// 2. Setup Canvas for measuring
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas context not available");

		canvas.width = W;
		// 先给个临时高度，量完文字再按内容定高
		canvas.height = px(100);

		// 3. Layout Calculation
		// 纵向节奏：封面 → 26 → kicker(26) → 标题(30/行) → 14 → 正文(21/行)
		//          → 24 → 分隔线 → 20 → 页脚(78) → 22
		const coverH = coverImg ? px(200) : px(150);
		const titleLH = px(30);
		const descLH = px(21);

		setFont(ctx, 700, 23);
		const titleLines = clampLines(ctx, title, contentW, 3);

		let descLines: string[] = [];
		if (description.trim()) {
			setFont(ctx, 400, 13);
			descLines = clampLines(ctx, description.trim(), contentW, 4);
		}

		let currentY = coverH;
		currentY += px(26);
		const kickerY = currentY;
		if (dateText) currentY += px(26);
		const titleY = currentY;
		currentY += titleLines.length * titleLH;
		let descY = 0;
		if (descLines.length) {
			currentY += px(14);
			descY = currentY;
			currentY += descLines.length * descLH;
		}
		currentY += px(24);
		const dividerY = currentY;
		currentY += px(1) + px(20);
		const footerY = currentY;
		currentY += px(78);
		currentY += px(22);

		// 4. Resize Canvas to fit content
		canvas.height = currentY;
		const H = canvas.height;

		// 5. Draw Content
		// 整卡圆角裁剪：封面吃到圆角
		ctx.save();
		drawRoundedRect(ctx, 0, 0, W, H, RADIUS);
		ctx.clip();

		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, W, H);

		// ── 封面（全幅，object-fit: cover）──
		if (coverImg) {
			const targetRatio = W / coverH;
			const imgRatio = coverImg.width / coverImg.height;
			let sx = 0;
			let sy = 0;
			let sw = coverImg.width;
			let sh = coverImg.height;

			if (imgRatio > targetRatio) {
				sw = coverImg.height * targetRatio;
				sx = (coverImg.width - sw) / 2;
			} else {
				sh = coverImg.width / targetRatio;
				sy = (coverImg.height - sh) / 2;
			}
			ctx.drawImage(coverImg, sx, sy, sw, sh, 0, 0, W, coverH);
		} else {
			// 无封面：用主题色的淡渐变撑一块横幅，两枚极淡圆点作层次
			const banner = ctx.createLinearGradient(0, 0, W, coverH);
			banner.addColorStop(0, withAlpha(themeColor, 0.22));
			banner.addColorStop(1, withAlpha(themeColor, 0.05));
			ctx.fillStyle = banner;
			ctx.fillRect(0, 0, W, coverH);

			ctx.fillStyle = withAlpha(themeColor, 0.1);
			ctx.beginPath();
			ctx.arc(W - px(26), px(14), px(74), 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(px(20), coverH - px(8), px(44), 0, Math.PI * 2);
			ctx.fill();
		}

		// ── 日期 kicker：一小段主题色短线 + 拉开字距的日期 ──
		if (dateText) {
			ctx.fillStyle = themeColor;
			drawRoundedRect(ctx, PAD, kickerY + px(5), px(16), px(3), px(1.5));
			ctx.fill();

			setFont(ctx, 600, 11);
			setTracking(ctx, px(1.4));
			ctx.fillStyle = themeColor;
			ctx.textAlign = "left";
			ctx.textBaseline = "middle";
			ctx.fillText(dateText, PAD + px(25), kickerY + px(6.5));
			setTracking(ctx, 0);
		}

		// ── 标题：最多三行，深墨色 ──
		setFont(ctx, 700, 23);
		ctx.fillStyle = POSTER_INK;
		ctx.textAlign = "left";
		ctx.textBaseline = "top";
		titleLines.forEach((line, i) => {
			ctx.fillText(line, PAD, titleY + i * titleLH);
		});

		// ── 摘要：最多四行，灰蓝色 ──
		if (descLines.length) {
			setFont(ctx, 400, 13);
			ctx.fillStyle = "#64748b";
			descLines.forEach((line, i) => {
				ctx.fillText(line, PAD, descY + i * descLH);
			});
		}

		// ── 分隔线 ──
		ctx.beginPath();
		ctx.moveTo(PAD, dividerY + px(0.5));
		ctx.lineTo(W - PAD, dividerY + px(0.5));
		ctx.strokeStyle = "#eef1f4";
		ctx.lineWidth = px(1);
		ctx.stroke();

		// ── 页脚：左作者、右二维码 ──
		const avatarSize = px(38);
		const avatarY = footerY + (qrCard - avatarSize) / 2;
		const qrX = W - PAD - qrCard;

		if (avatarImg) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(
				PAD + avatarSize / 2,
				avatarY + avatarSize / 2,
				avatarSize / 2,
				0,
				Math.PI * 2,
			);
			ctx.closePath();
			ctx.clip();

			// 头像同样按 cover 裁切
			const aRatio = avatarImg.width / avatarImg.height;
			let asx = 0;
			let asy = 0;
			let asw = avatarImg.width;
			let ash = avatarImg.height;
			if (aRatio > 1) {
				asw = avatarImg.height;
				asx = (avatarImg.width - asw) / 2;
			} else {
				ash = avatarImg.width;
				asy = (avatarImg.height - ash) / 2;
			}
			ctx.drawImage(
				avatarImg,
				asx,
				asy,
				asw,
				ash,
				PAD,
				avatarY,
				avatarSize,
				avatarSize,
			);
			ctx.restore();

			ctx.beginPath();
			ctx.arc(
				PAD + avatarSize / 2,
				avatarY + avatarSize / 2,
				avatarSize / 2,
				0,
				Math.PI * 2,
			);
			ctx.strokeStyle = withAlpha(themeColor, 0.3);
			ctx.lineWidth = px(1.5);
			ctx.stroke();
		}

		const authorX = PAD + (avatarImg ? avatarSize + px(12) : 0);

		setFont(ctx, 600, 9);
		setTracking(ctx, px(1.2));
		ctx.fillStyle = "#94a3b8";
		ctx.textAlign = "left";
		ctx.textBaseline = "top";
		ctx.fillText(i18n(I18nKey.author).toUpperCase(), authorX, avatarY + px(4));
		setTracking(ctx, 0);

		setFont(ctx, 700, 16);
		ctx.fillStyle = POSTER_INK;
		ctx.fillText(
			fitText(ctx, author, qrX - px(18) - authorX),
			authorX,
			avatarY + px(17),
		);

		// 二维码：白卡 + 细描边，落在浅色页脚上也不糊
		ctx.save();
		ctx.shadowColor = "rgba(15, 23, 42, 0.07)";
		ctx.shadowBlur = px(10);
		ctx.shadowOffsetY = px(3);
		ctx.fillStyle = "#ffffff";
		drawRoundedRect(ctx, qrX, footerY, qrCard, qrCard, px(12));
		ctx.fill();
		ctx.restore();

		drawRoundedRect(ctx, qrX, footerY, qrCard, qrCard, px(12));
		ctx.strokeStyle = "rgba(15, 23, 42, 0.07)";
		ctx.lineWidth = px(1);
		ctx.stroke();

		if (qrImg) {
			const qrOffset = (qrCard - qrInner) / 2;
			ctx.drawImage(
				qrImg,
				qrX + qrOffset,
				footerY + qrOffset,
				qrInner,
				qrInner,
			);
		}

		setFont(ctx, 500, 9);
		setTracking(ctx, px(0.6));
		ctx.fillStyle = "#94a3b8";
		ctx.textAlign = "center";
		ctx.textBaseline = "top";
		ctx.fillText(
			fitText(ctx, i18n(I18nKey.scanToRead), qrCard + px(24)),
			qrX + qrCard / 2,
			footerY + qrCard + px(6),
		);
		setTracking(ctx, 0);

		ctx.restore(); // 结束圆角裁剪

		// 极细描边：浅色背景下卡片边界不至于糊掉
		drawRoundedRect(ctx, px(0.5), px(0.5), W - px(1), H - px(1), RADIUS);
		ctx.strokeStyle = "rgba(15, 23, 42, 0.08)";
		ctx.lineWidth = px(1);
		ctx.stroke();

		// Finalize
		posterImage = canvas.toDataURL("image/png");
		generating = false;
	} catch (error) {
		console.error("Failed to generate poster:", error);
		generating = false;
	}
}

function closeModal() {
	showModal = false;
}

let copiedKey: string | null = null;
function copyLink(key = "copy") {
	navigator.clipboard.writeText(url);
	copiedKey = key;
	setTimeout(() => {
		copiedKey = null;
	}, 2000);
}

// ── 分享按钮：圆形主按钮 + 点击后绕圆周展开的 8 个分享入口 ──
let dockOpen = false;
let dockEl: HTMLDivElement | undefined;

function toggleDock() {
	dockOpen = !dockOpen;
}

function closeDock() {
	dockOpen = false;
}

const encodedUrl = encodeURIComponent(url);
const encodedTitle = encodeURIComponent(title);

// 位移按主按钮 38px 与子项 38px 的直径算：正向 60px、对角 40px，
// 保持与参考实现（48px 按钮 + 70/47px）相同的圆间空隙，8 个入口绕主按钮排一圈
const shareTargets = [
	{
		key: "tiktok",
		label: "TikTok：复制链接",
		icon: "simple-icons:tiktok",
		tx: 60,
		ty: 0,
		// TikTok 没有网页分享端点，和微信一样退化成复制链接
		href: null,
	},
	{
		key: "wechat",
		label: "微信：复制链接",
		icon: "simple-icons:wechat",
		tx: 40,
		ty: -40,
		href: null,
	},
	{
		key: "qq",
		label: "分享到 QQ",
		icon: "simple-icons:qq",
		tx: 0,
		ty: -60,
		href: `https://connect.qq.com/widget/shareqq/index.html?url=${encodedUrl}&title=${encodedTitle}`,
	},
	{
		key: "facebook",
		label: "分享到 Facebook",
		icon: "simple-icons:facebook",
		tx: -40,
		ty: -40,
		href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
	},
	{
		key: "x",
		label: "分享到 X",
		icon: "simple-icons:x",
		tx: -60,
		ty: 0,
		href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
	},
	{
		key: "instagram",
		label: "Instagram：复制链接",
		icon: "simple-icons:instagram",
		tx: -40,
		ty: 40,
		// Instagram 同样没有网页分享端点，退化成复制链接
		href: null,
	},
	{
		key: "copy",
		label: i18n(I18nKey.copyLink),
		icon: "material-symbols:link",
		tx: 0,
		ty: 60,
		href: null,
	},
	{
		key: "poster",
		label: i18n(I18nKey.sharePoster),
		icon: "material-symbols:qr-code",
		tx: 40,
		ty: 40,
		href: null,
	},
];

onMount(() => {
	// 点击空白处或按 Esc 收起
	const onDocClick = (e: MouseEvent) => {
		if (dockOpen && dockEl && !dockEl.contains(e.target as Node)) dockOpen = false;
	};
	const onKeydown = (e: KeyboardEvent) => {
		if (e.key === "Escape") {
			dockOpen = false;
			showModal = false;
		}
	};
	document.addEventListener("click", onDocClick);
	document.addEventListener("keydown", onKeydown);
	return () => {
		document.removeEventListener("click", onDocClick);
		document.removeEventListener("keydown", onKeydown);
	};
});

function portal(node: HTMLElement) {
	document.body.appendChild(node);
	return {
		destroy() {
			if (node.parentNode) {
				node.parentNode.removeChild(node);
			}
		},
	};
}
</script>

<!-- Trigger: 圆形分享按钮，点击展开/收起 8 个分享入口并按阶梯延迟向四周弹出 -->
<div
  class="share-dock"
  class:is-open={dockOpen}
  bind:this={dockEl}
  style="--dock-count:{shareTargets.length}"
>
  <button
    class="share-dock-main"
    type="button"
    aria-haspopup="true"
    aria-expanded={dockOpen}
    aria-label={i18n(I18nKey.shareArticle)}
    title={i18n(I18nKey.shareArticle)}
    on:click={toggleDock}
  >
    <Icon icon="material-symbols:share" class="share-dock-icon" />
  </button>

  {#each shareTargets as item, i}
    {#if item.href}
      <a
        class="share-dock-item"
        data-key={item.key}
        style="--tx:{item.tx}px;--ty:{item.ty}px;--i:{i}"
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        tabindex={dockOpen ? 0 : -1}
        title={item.label}
        aria-label={item.label}
        on:click={closeDock}
      >
        <Icon icon={item.icon} class="share-dock-icon" />
      </a>
    {:else}
      <button
        class="share-dock-item"
        data-key={item.key}
        type="button"
        style="--tx:{item.tx}px;--ty:{item.ty}px;--i:{i}"
        tabindex={dockOpen ? 0 : -1}
        title={item.label}
        aria-label={item.label}
        on:click={() => {
          if (item.key === "poster") {
            closeDock();
            generatePoster();
          } else {
            copyLink(item.key);
          }
        }}
      >
        <Icon
          icon={item.key !== "poster" && copiedKey === item.key
            ? "material-symbols:check"
            : item.icon}
          class="share-dock-icon"
        />
      </button>
    {/if}
  {/each}
</div>



<!-- 海报：只显示图片，点任意处（含图片）关闭 -->
{#if showModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div use:portal class="poster-stage" on:click={closeModal}>
    {#if posterImage}
      <img
        class="poster-image"
        src={posterImage}
        alt={i18n(I18nKey.sharePoster)}
      />
    {:else}
      <div class="poster-loading">
        <div class="poster-spinner" style="border-top-color: {themeColor}"></div>
        <span>{i18n(I18nKey.generatingPoster)}</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ── 圆形分享按钮（动效移植自 csozi 的 neumorphic share button）──
     结构：容器 grid 居中 → 主按钮 z-index 100 + 8 个绝对定位子按钮（叠在主按钮下面）
     展开：子按钮按 0.1s 阶梯延迟逐个 translate 到指定坐标，同时浮出 neumorphic 阴影 */
  .share-dock {
    /* 与打赏按钮的金币同直径（coin.json 金币占画布 39.5%，6rem 容器 ≈ 2.375rem），
       两个圆形入口并排时视觉齐平 */
    --dock-size: 2.375rem;
    --dock-bg: var(--btn-regular-bg);
    --dock-icon: #4b5563;
    --dock-shadow-dark: #cbcbcb;
    --dock-shadow-light: #ffffff;

    position: relative;
    display: grid;
    place-items: center;
    width: fit-content;
    height: fit-content;
    border-radius: 50%;
    transition: 0.3s;
    z-index: var(--z-content);
  }

  :global(.dark) .share-dock {
    --dock-icon: #d4d4d4;
    --dock-shadow-dark: rgba(0, 0, 0, 0.65);
    --dock-shadow-light: rgba(255, 255, 255, 0.08);
  }

  /* 展开时抬高层级：子按钮允许盖在打赏等相邻按钮之上 */
  .share-dock.is-open {
    z-index: calc(var(--z-content) + 10);
  }

  .share-dock-main {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--dock-size);
    height: var(--dock-size);
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--dock-bg);
    color: var(--dock-icon);
    box-shadow:
      4px 4px 10px var(--dock-shadow-dark),
      -4px -4px 10px var(--dock-shadow-light);
    cursor: pointer;
    transition: 0.2s;
    z-index: 100;
  }

  .share-dock-item {
    position: absolute;
    display: grid;
    place-items: center;
    width: var(--dock-size);
    height: var(--dock-size);
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--dock-bg);
    color: var(--dock-icon);
    /* 收起时阴影透明，展开时浮出，对应参考实现的 box-shadow 过渡 */
    box-shadow: 4px 4px 10px transparent, -4px -4px 10px transparent;
    cursor: pointer;
    transition:
      translate 0.3s ease 0s,
      background-color 0.3s ease 0s,
      box-shadow 0.3s ease 0s,
      color 0.3s ease 0s;
    /* 收起时按倒序回收：最后弹出去的先回来，和展开形成镜像；
       序号最大的 --i 延迟 0s，最小的最后收，总时长与展开一致 */
    transition-delay:
      calc((var(--dock-count) - 1 - var(--i)) * 0.1s), 0s,
      calc((var(--dock-count) - 1 - var(--i)) * 0.1s), 0s;
    z-index: 1;
  }

  .share-dock.is-open .share-dock-item {
    translate: var(--tx) var(--ty);
    box-shadow:
      4px 4px 10px var(--dock-shadow-dark),
      -4px -4px 10px var(--dock-shadow-light);
    /* 位移与阴影按序号阶梯延迟，变色保持即时 */
    transition-delay:
      calc(var(--i) * 0.1s), 0s, calc(var(--i) * 0.1s), 0s;
  }

  .share-dock :global(.share-dock-icon) {
    width: 1.25rem;
    height: 1.25rem;
    pointer-events: none;
  }

  .share-dock-item[data-key="tiktok"]:hover {
    background-color: #010101;
    color: #fff;
  }

  .share-dock-item[data-key="x"]:hover {
    background-color: #111;
    color: #fff;
  }

  .share-dock-item[data-key="instagram"]:hover {
    /* 品牌渐变，覆盖 background-color 的单色底 */
    background: linear-gradient(
      45deg,
      #f09433,
      #e6683c,
      #dc2743,
      #cc2366,
      #bc1888
    );
    color: #fff;
  }

  .share-dock-item[data-key="qq"]:hover {
    background-color: #12b7f5;
    color: #fff;
  }

  .share-dock-item[data-key="wechat"]:hover {
    background-color: #07c160;
    color: #fff;
  }

  .share-dock-item[data-key="facebook"]:hover {
    background-color: #1877f2;
    color: #fff;
  }

  .share-dock-item[data-key="copy"]:hover,
  .share-dock-item[data-key="poster"]:hover {
    background-color: var(--primary);
    color: #fff;
  }

  .share-dock-main:focus-visible,
  .share-dock-item:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .share-dock-item {
      transition-duration: 1ms;
    }
  }

  /* ── 海报浮层 ──
     没有遮罩、没有外框、没有按钮：只把生成好的图片贴在页面中央，
     点图片保存，点空白处或按 Esc 关闭。 */
  .poster-stage {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .poster-image {
    width: auto;
    height: auto;
    max-width: min(86vw, 21rem);
    max-height: 80vh;
    /* 海报本身已经画好 22px 圆角（2x 输出），这里对齐到显示尺寸的等效弧度 */
    border-radius: 1.1rem;
    box-shadow: 0 22px 58px -20px rgb(0 0 0 / 0.5);
    cursor: zoom-out;
  }

  /* 生成中的极简提示：一枚小胶囊，避免等待时页面上什么都没有 */
  .poster-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-radius: 0.875rem;
    background: var(--card-bg);
    color: var(--deep-text);
    box-shadow: 0 16px 40px -16px rgb(0 0 0 / 0.4);
    font-size: 0.8125rem;
  }

  .poster-spinner {
    width: 2rem;
    height: 2rem;
    border: 2px solid var(--line-divider);
    border-radius: 50%;
    animation: poster-spin 0.9s linear infinite;
  }

  @keyframes poster-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
