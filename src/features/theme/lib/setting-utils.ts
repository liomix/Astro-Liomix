/**
 * 设置读写（对外出口）
 * ---------------------------------------------------------------------------
 * 实现按职责拆在 ./settings/ 下：主题、壁纸、浮层、特效、外观开关、评论壁纸。
 * 这里只做 re-export，调用点（`@/features/theme/lib/setting-utils`）保持不变 ——
 * 拆分是为了让「改主题」和「改壁纸」不再读同一个 1288 行的文件。
 */

export * from "@/features/theme/lib/settings/appearance";
export * from "@/features/theme/lib/settings/effects";
export * from "@/features/theme/lib/settings/overlay";
export * from "@/features/theme/lib/settings/theme";
export * from "@/features/theme/lib/settings/wallpaper";
export * from "@/shared/lib/comments/wallpaper-setting";
