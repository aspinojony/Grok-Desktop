/**
 * Lightweight i18n for Grok Desktop UI (zh-CN / en-US).
 * Renderer uses t() + data-i18n; Host only stores locale preference.
 */
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  type LocalePreference,
} from "./types.js";
import { enUS } from "./locales/en-US.js";
import { zhCN, type MessageKey } from "./locales/zh-CN.js";

export type { Locale, LocalePreference, MessageKey };
export {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isLocale,
  isLocalePreference,
} from "./types.js";

const catalogs: Record<Locale, Record<MessageKey, string>> = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

let current: Locale = DEFAULT_LOCALE;
const listeners = new Set<(locale: Locale) => void>();

export type TParams = Record<string, string | number | boolean | null | undefined>;

/** Resolve preference + optional system tag (e.g. app.getLocale / navigator.language). */
export function resolveLocale(
  preference: LocalePreference | string | undefined | null,
  systemLocale?: string | null,
): Locale {
  if (preference && preference !== "system" && isLocale(preference)) {
    return preference;
  }
  const sys = (systemLocale ?? "").trim().toLowerCase();
  if (sys.startsWith("zh")) return "zh-CN";
  if (sys.startsWith("en")) return "en-US";
  // Desktop product default remains Chinese when system is neither.
  return DEFAULT_LOCALE;
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  if (current === locale) return;
  current = locale;
  for (const fn of listeners) {
    try {
      fn(locale);
    } catch {
      /* ignore listener errors */
    }
  }
}

export function onLocaleChange(fn: (locale: Locale) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = params[key];
    return v == null ? "" : String(v);
  });
}

/** Translate a message key; falls back to zh-CN then the key itself. */
export function t(key: MessageKey | string, params?: TParams): string {
  const primary = catalogs[current][key as MessageKey];
  const fallback = catalogs[DEFAULT_LOCALE][key as MessageKey];
  const raw = primary ?? fallback ?? key;
  return interpolate(raw, params);
}

/**
 * Alias for `t` used in renderer code where a local variable named `t`
 * (e.g. event target / text) would shadow the translator.
 */
export const tr = t;

/**
 * Apply translations to a DOM subtree.
 *
 * Attributes:
 * - data-i18n="key"           → textContent (or specified attr via data-i18n-attr)
 * - data-i18n-title="key"     → title
 * - data-i18n-placeholder     → placeholder
 * - data-i18n-aria-label      → aria-label
 * - data-i18n-html="key"      → innerHTML (trusted static catalogs only)
 */
export function applyDomI18n(root: ParentNode = document): void {
  const nodes = root.querySelectorAll<HTMLElement>(
    "[data-i18n], [data-i18n-title], [data-i18n-placeholder], [data-i18n-aria-label], [data-i18n-html]",
  );
  for (const el of Array.from(nodes)) {
    const textKey = el.getAttribute("data-i18n");
    if (textKey) {
      const attr = el.getAttribute("data-i18n-attr");
      const value = t(textKey);
      if (attr) el.setAttribute(attr, value);
      else el.textContent = value;
    }
    const titleKey = el.getAttribute("data-i18n-title");
    if (titleKey) el.title = t(titleKey);

    const phKey = el.getAttribute("data-i18n-placeholder");
    if (phKey && "placeholder" in el) {
      (el as HTMLInputElement).placeholder = t(phKey);
    }

    const ariaKey = el.getAttribute("data-i18n-aria-label");
    if (ariaKey) el.setAttribute("aria-label", t(ariaKey));

    const htmlKey = el.getAttribute("data-i18n-html");
    if (htmlKey) el.innerHTML = t(htmlKey);
  }

  if (root === document || root === document.documentElement) {
    document.documentElement.lang = current;
  } else if (root instanceof Document) {
    root.documentElement.lang = current;
  }
}

/** List of keys present in zh-CN but missing/empty in en-US (for tests). */
export function missingEnglishKeys(): MessageKey[] {
  const missing: MessageKey[] = [];
  for (const key of Object.keys(zhCN) as MessageKey[]) {
    const v = enUS[key];
    if (v == null || v === "") missing.push(key);
  }
  return missing;
}
