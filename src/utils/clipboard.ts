/**
 * 复制文本到剪贴板
 * ---------------------------------------------------------------------------
 * 优先用 Clipboard API；拿不到权限（老浏览器、非安全上下文、权限被拒）就退回
 * 那个上古的 textarea + execCommand 兜底，否则用户会看到「点了复制但没反应」。
 *
 * 两个地方共用这一份：消息右键菜单的「复制」、代码块顶栏的复制按钮
 * （都在评论组件里，原先各写了一遍一模一样的实现）。
 */
export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		const area = document.createElement("textarea");
		area.value = text;
		area.setAttribute("readonly", "");
		// 不能用 hidden / display:none —— 那样 select() 选不中，复制出来是空的
		area.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
		document.body.append(area);
		area.select();
		const ok = document.execCommand("copy");
		area.remove();
		return ok;
	}
}
