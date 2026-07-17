import { describe, expect, it } from "vitest";
import {
  getLocale,
  missingEnglishKeys,
  resolveLocale,
  setLocale,
  t,
} from "../src/shared/i18n/index.js";

describe("i18n", () => {
  it("en-US covers every zh-CN key", () => {
    expect(missingEnglishKeys()).toEqual([]);
  });

  it("resolves system locale", () => {
    expect(resolveLocale("system", "en-US")).toBe("en-US");
    expect(resolveLocale("system", "zh-CN")).toBe("zh-CN");
    expect(resolveLocale("en-US", "zh-CN")).toBe("en-US");
    expect(resolveLocale("zh-CN", "en-GB")).toBe("zh-CN");
  });

  it("translates and interpolates", () => {
    setLocale("zh-CN");
    expect(t("nav.newChat")).toBe("新对话");
    expect(t("time.minutes", { n: 3 })).toBe("3 分");
    setLocale("en-US");
    expect(t("nav.newChat")).toBe("New chat");
    expect(t("time.minutes", { n: 3 })).toBe("3m");
    expect(getLocale()).toBe("en-US");
    setLocale("zh-CN");
  });
});
