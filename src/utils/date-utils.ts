import { siteConfig } from "../config";

// 语言代码映射（i18n 的 lang → BCP 47 locale）
const LANG_TO_LOCALE: Record<string, string> = {
	zh_CN: "zh-CN",
	zh_TW: "zh-TW",
	en: "en-US",
	ja: "ja-JP",
	ko: "ko-KR",
	es: "es-ES",
	th: "th-TH",
	vi: "vi-VN",
	tr: "tr-TR",
	id: "id-ID",
	fr: "fr-FR",
	de: "de-DE",
	ru: "ru-RU",
	ar: "ar-SA",
};

function getLocale(): string {
	return LANG_TO_LOCALE[siteConfig.lang || "en"] || "en-US";
}

/**
 * 判断日期是否为纯日期输入（如 YAML 中仅填写 YYYY-MM-DD，解析为 UTC 午夜）。
 * 对于此类纯日历日期，应保留原日期，避免在 UTC 以西时区（如美西/美东）转换后倒退一天。
 */
export function isDateOnly(dateInput: Date | string): boolean {
	if (typeof dateInput === "string") {
		return /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim());
	}
	return (
		dateInput.getUTCHours() === 0 &&
		dateInput.getUTCMinutes() === 0 &&
		dateInput.getUTCSeconds() === 0 &&
		dateInput.getUTCMilliseconds() === 0
	);
}

export function formatDateToYYYYMMDD(dateInput: Date | string): string {
	if (!dateInput) return "";

	if (typeof dateInput === "string") {
		const trimmed = dateInput.trim();
		if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
			return trimmed;
		}
	}

	const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
	if (Number.isNaN(date.getTime())) return "";

	// 纯日期输入保留原日历日期，避免在 UTC 以西时区倒退一天
	if (isDateOnly(date)) {
		return date.toISOString().substring(0, 10);
	}

	const options: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	};

	if (siteConfig.timezone) {
		options.timeZone = siteConfig.timezone;
	}

	const parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value || "";

	return `${get("year")}-${get("month")}-${get("day")}`;
}

// 国际化日期格式化函数
export function formatDateI18n(
	dateInput: Date | string,
	includeTime?: boolean,
): string {
	const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

	// 根据语言设置不同的日期格式
	const options: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "long",
		day: "numeric",
	};

	if (includeTime) {
		options.hour = "2-digit";
		options.minute = "2-digit";
		options.second = "2-digit";
	}

	// 如果配置了时区，则将其用于格式化（IANA 时区字符串）
	if (siteConfig.timezone) {
		(options as Intl.DateTimeFormatOptions).timeZone = siteConfig.timezone;
	}

	// 语言代码映射
	const locale = getLocale();
	return includeTime
		? date.toLocaleString(locale, options)
		: date.toLocaleDateString(locale, options);
}

// 国际化日期时间格式化函数（带时分秒）
export function formatDateI18nWithTime(dateInput: Date | string): string {
	return formatDateI18n(dateInput, true);
}

/**
 * 相对时间文案，按分钟/小时/天/月/年逐级递进。
 * 超过 6 年返回 null，由调用方改为显示具体年月日。
 * 例：3分钟前 / 5小时前 / 12天前 / 3个月前 / 2年前
 */
export function formatRelativeTime(
	dateInput: Date | string,
	now: Date | number = Date.now(),
): string | null {
	const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
	if (Number.isNaN(date.getTime())) return "";

	const nowMs = now instanceof Date ? now.getTime() : now;
	const diffMs = nowMs - date.getTime();
	if (diffMs < 0) return null; // 未来时间不做相对描述

	const rtf = new Intl.RelativeTimeFormat(getLocale(), {
		numeric: "always",
	});
	const MINUTE = 60_000;
	const HOUR = 60 * MINUTE;
	const DAY = 24 * HOUR;

	if (diffMs < HOUR) {
		return rtf.format(-Math.max(1, Math.floor(diffMs / MINUTE)), "minute");
	}
	if (diffMs < DAY) {
		return rtf.format(-Math.floor(diffMs / HOUR), "hour");
	}

	const days = Math.floor(diffMs / DAY);
	if (days < 30) return rtf.format(-days, "day");

	const months = Math.floor(days / 30);
	if (months <= 12) return rtf.format(-Math.max(1, months), "month");

	const years = days / 365.25;
	if (years <= 6) return rtf.format(-Math.floor(years), "year");

	return null;
}

/**
 * 动态卡片用的日期：统一显示「YYYY-MM-DD HH:mm」。
 * 纯日期输入（仅 YYYY-MM-DD）保持「YYYY-MM-DD」。
 */
export function formatDynamicDate(
	dateInput: Date | string,
	timeZone: string = siteConfig.timezone || "UTC",
): string {
	if (!dateInput) return "";

	if (typeof dateInput === "string") {
		const trimmed = dateInput.trim();
		if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
	}

	const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
	if (Number.isNaN(date.getTime())) return "";

	const format = (value: Date) => {
		const parts = new Intl.DateTimeFormat("en-CA", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
			timeZone,
		}).formatToParts(value);
		const get = (type: Intl.DateTimeFormatPartTypes) =>
			parts.find((part) => part.type === type)?.value || "";
		return {
			year: get("year"),
			month: get("month"),
			day: get("day"),
			hour: get("hour"),
			minute: get("minute"),
		};
	};

	if (isDateOnly(date)) {
		const { year, month, day } = format(date);
		return `${year}-${month}-${day}`;
	}

	const current = format(date);
	return `${current.year}-${current.month}-${current.day} ${current.hour}:${current.minute}`;
}

export function formatTimezoneOffset(
	timezone: string,
	dateInput: Date | string,
): string {
	const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
	const timezoneName = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		timeZoneName: "longOffset",
	})
		.formatToParts(date)
		.find((part) => part.type === "timeZoneName")?.value;

	if (!timezoneName || timezoneName === "GMT") return "UTC";

	return timezoneName
		.replace("GMT", "UTC")
		.replace(/([+-])0(\d)/, "$1$2")
		.replace(":00", "");
}

// 统一格式为 YYYY-MM-DD HH:mm，支持站点时区
export function formatDateTimeToYYYYMMDDHHmm(dateInput: Date | string): string {
	const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

	const options: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	};

	if (siteConfig.timezone) {
		options.timeZone = siteConfig.timezone;
	}

	const parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value || "";

	return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/**
 * 秒 → 紧凑时长文案，超过 1 小时自动进位。
 * 例：0 → "0m"、540 → "9m"、3600 → "1h"、12720 → "3h 32m"
 */
export function formatDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
	const totalMinutes = Math.max(1, Math.round(seconds / 60));
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours <= 0) return `${minutes}m`;
	return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}
