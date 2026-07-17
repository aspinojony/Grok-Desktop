/** Supported UI locales (BCP 47). */
export type Locale = "zh-CN" | "en-US";

export const SUPPORTED_LOCALES: readonly Locale[] = ["zh-CN", "en-US"] as const;

export const DEFAULT_LOCALE: Locale = "zh-CN";

/** Stored in settings.json; `system` follows OS / Chromium locale. */
export type LocalePreference = Locale | "system";

export function isLocale(v: unknown): v is Locale {
  return v === "zh-CN" || v === "en-US";
}

export function isLocalePreference(v: unknown): v is LocalePreference {
  return v === "system" || isLocale(v);
}
