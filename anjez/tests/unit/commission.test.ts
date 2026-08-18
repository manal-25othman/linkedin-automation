import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMMISSION_SETTINGS,
  calculateCommission,
  canRequestPayout,
  clampBps,
  commissionBase,
  isClickWithinWindow,
  isMature,
  maturityDate,
  nextTierGap,
  resolveAttribution,
  resolveRateBps,
  summarizeBalances,
  tierForSales,
} from "@/lib/affiliate/commission";

const settings = DEFAULT_COMMISSION_SETTINGS;

describe("resolveRateBps", () => {
  it("النسبة التفاوضية تتجاوز نسبة الخدمة ومكافأة المستوى", () => {
    const rate = resolveRateBps({
      affiliateCustomBps: 2500,
      serviceBps: 1000,
      tier: "GOLD",
      settings,
    });
    expect(rate).toBe(2500);
  });

  it("نسبة الخدمة تسبق النسبة العامة وتُضاف إليها مكافأة المستوى", () => {
    expect(resolveRateBps({ serviceBps: 1000, tier: "SILVER", settings })).toBe(1200);
    expect(resolveRateBps({ serviceBps: null, tier: "BRONZE", settings })).toBe(1500);
    expect(resolveRateBps({ serviceBps: null, tier: "GOLD", settings })).toBe(2000);
  });

  it("لا تتجاوز النسبة السقف ولا تنزل عن الصفر", () => {
    expect(resolveRateBps({ serviceBps: 9000, tier: "GOLD", settings })).toBe(settings.maxBps);
    expect(resolveRateBps({ affiliateCustomBps: -500, tier: "BRONZE", settings })).toBe(0);
  });

  it("clampBps يقرّب ويحصر", () => {
    expect(clampBps(1234.6, 5000)).toBe(1235);
    expect(clampBps(Number.NaN, 5000)).toBe(0);
  });
});

describe("calculateCommission", () => {
  it("يحسب النسبة من الوعاء بالهللات", () => {
    expect(calculateCommission(100_000, 1500)).toBe(15_000);
  });

  it("يقرّب لأسفل ولا يُنتج كسور هللة", () => {
    // ٣٣٣ هللة × ١٥٪ = ٤٩٫٩٥ هللة
    expect(calculateCommission(333, 1500)).toBe(49);
  });

  it("يعيد صفرًا للمدخلات غير الموجبة", () => {
    expect(calculateCommission(0, 1500)).toBe(0);
    expect(calculateCommission(100_000, 0)).toBe(0);
    expect(calculateCommission(-100, 1500)).toBe(0);
  });

  it("الوعاء هو المدفوع بعد الخصم لا السعر المعلن", () => {
    const order = { subtotal: 100_000, discount: 20_000, total: 80_000 };
    expect(commissionBase(order)).toBe(80_000);
    expect(calculateCommission(commissionBase(order), 1500)).toBe(12_000);
  });
});

describe("المستويات", () => {
  it("يرقّي حسب العتبات", () => {
    expect(tierForSales(0)).toBe("BRONZE");
    expect(tierForSales(999_999)).toBe("BRONZE");
    expect(tierForSales(1_000_000)).toBe("SILVER");
    expect(tierForSales(5_000_000)).toBe("GOLD");
    expect(tierForSales(50_000_000)).toBe("GOLD");
  });

  it("يحسب المتبقّي للمستوى التالي، وnull عند القمّة", () => {
    expect(nextTierGap(400_000)).toEqual({ tier: "SILVER", remaining: 600_000 });
    expect(nextTierGap(1_000_000)).toEqual({ tier: "GOLD", remaining: 4_000_000 });
    expect(nextTierGap(5_000_000)).toBeNull();
  });
});

describe("مدّة التثبيت", () => {
  it("الاستحقاق بعد اكتمال الطلب بمدّة التثبيت", () => {
    const completed = new Date("2026-01-01T00:00:00Z");
    const matures = maturityDate(completed, settings);
    expect(matures.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(isMature(matures, new Date("2026-01-14T23:59:00Z"))).toBe(false);
    expect(isMature(matures, new Date("2026-01-15T00:00:01Z"))).toBe(true);
    expect(isMature(null)).toBe(false);
  });
});

describe("نافذة الإحالة", () => {
  const now = new Date("2026-02-01T00:00:00Z");

  it("النقرة داخل النافذة صالحة وخارجها ساقطة", () => {
    expect(isClickWithinWindow(new Date("2026-01-20T00:00:00Z"), now, 30)).toBe(true);
    expect(isClickWithinWindow(new Date("2025-12-01T00:00:00Z"), now, 30)).toBe(false);
  });

  it("نقرة بتاريخ مستقبلي مرفوضة (ساعة عميل مغلوطة أو تلاعب)", () => {
    expect(isClickWithinWindow(new Date("2026-02-02T00:00:00Z"), now, 30)).toBe(false);
  });
});

describe("resolveAttribution", () => {
  it("الكوبون يسبق الكوكي", () => {
    expect(
      resolveAttribution({ couponAffiliateId: "aff_coupon", cookieAffiliateId: "aff_cookie" }),
    ).toEqual({ affiliateId: "aff_coupon", source: "COUPON" });
  });

  it("الكوكي وحده ينسب البيع عبر الرابط", () => {
    expect(resolveAttribution({ cookieAffiliateId: "aff_cookie" })).toEqual({
      affiliateId: "aff_cookie",
      source: "LINK",
    });
  });

  it("بلا إحالة", () => {
    expect(resolveAttribution({})).toEqual({ affiliateId: null, source: "NONE" });
  });
});

describe("summarizeBalances", () => {
  it("يفصل المعلّق عن المتاح عن المحجوز في سحب قائم عن المصروف", () => {
    const balances = summarizeBalances([
      { status: "PENDING", amount: 5_000 },
      { status: "APPROVED", amount: 10_000 },
      { status: "APPROVED", amount: 7_000, payoutId: "payout_1" },
      { status: "PAID", amount: 30_000 },
      { status: "CANCELLED", amount: 9_999 },
    ]);

    expect(balances).toEqual({
      pending: 5_000,
      available: 10_000,
      reserved: 7_000,
      paid: 30_000,
      lifetime: 47_000,
    });
  });
});

describe("canRequestPayout", () => {
  it("يمنع السحب دون الحدّ الأدنى", () => {
    const result = canRequestPayout(15_000, settings);
    expect(result.ok).toBe(false);
  });

  it("يمنع السحب بلا رصيد", () => {
    expect(canRequestPayout(0, settings).ok).toBe(false);
  });

  it("يسمح عند بلوغ الحدّ", () => {
    expect(canRequestPayout(20_000, settings)).toEqual({ ok: true });
  });
});
