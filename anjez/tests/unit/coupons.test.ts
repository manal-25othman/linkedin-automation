import { describe, expect, it } from "vitest";
import { evaluateCoupon, type CouponLike } from "@/lib/affiliate/coupons";
import { normalizeCode, generateOrderNumber, suggestCode, randomCode } from "@/lib/affiliate/codes";
import { formatMoney, parseRiyalsInput, riyalsToHalalas } from "@/lib/money";

const base: CouponLike = {
  code: "SAVE10",
  type: "PERCENT",
  value: 1000,
  isActive: true,
  maxUses: null,
  usedCount: 0,
  expiresAt: null,
};

describe("evaluateCoupon", () => {
  it("خصم نسبي", () => {
    expect(evaluateCoupon(base, 50_000)).toEqual({ ok: true, discount: 5_000 });
  });

  it("خصم ثابت لا يتجاوز قيمة الطلب", () => {
    const coupon: CouponLike = { ...base, type: "FIXED", value: 100_000 };
    expect(evaluateCoupon(coupon, 40_000)).toEqual({ ok: true, discount: 40_000 });
  });

  it("يرفض الكود المتوقّف والمنتهي والمستنفد", () => {
    expect(evaluateCoupon({ ...base, isActive: false }, 50_000).ok).toBe(false);
    expect(
      evaluateCoupon({ ...base, expiresAt: new Date("2020-01-01") }, 50_000).ok,
    ).toBe(false);
    expect(evaluateCoupon({ ...base, maxUses: 5, usedCount: 5 }, 50_000).ok).toBe(false);
    expect(evaluateCoupon(null, 50_000).ok).toBe(false);
  });
});

describe("الأكواد", () => {
  it("يُطبِّع المدخل بلا فواصل وبأرقام لاتينية", () => {
    expect(normalizeCode("  save-10 ")).toBe("SAVE10");
    expect(normalizeCode("كود ٢٠٢٦")).toBe("2026");
  });

  it("الكود العشوائي خالٍ من الحروف الملتبسة", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(randomCode(8)).not.toMatch(/[O01IL]/);
    }
  });

  it("يقترح كودًا من الاسم اللاتيني وإلا عشوائيًا", () => {
    expect(suggestCode("Manal Othman")).toMatch(/^MANA[A-Z2-9]{3}$/);
    expect(suggestCode("منال")).toMatch(/^[A-Z2-9]{7}$/);
  });

  it("رقم الطلب يحمل السنة والشهر", () => {
    expect(generateOrderNumber(new Date("2026-08-17T10:00:00Z"))).toMatch(
      /^ANJ-2608-[A-Z2-9]{6}$/,
    );
  });
});

describe("المبالغ", () => {
  it("يحوّل الريالات إلى هللات ويقرأ مدخلات النماذج", () => {
    expect(riyalsToHalalas(199.99)).toBe(19_999);
    expect(parseRiyalsInput("1,250")).toBe(125_000);
    expect(parseRiyalsInput("٥٠")).toBe(5_000);
    expect(parseRiyalsInput("-3")).toBeNull();
    expect(parseRiyalsInput("")).toBeNull();
  });

  it("يعرض المبلغ بالريال", () => {
    expect(formatMoney(125_000)).toBe("1,250 ر.س");
  });
});
