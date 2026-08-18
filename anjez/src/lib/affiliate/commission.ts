/**
 * محرّك العمولات — دوال نقية بلا وصول لقاعدة بيانات أو شبكة.
 *
 * كل النِسَب بنقاط الأساس (bps): 10000 bps = 100٪، 1500 bps = 15٪.
 * كل المبالغ بالهللات.
 *
 * فصل هذه القواعد عن الاستعلامات مقصود: المال هو أكثر ما يختلف عليه المسوّقون،
 * وكل قاعدة هنا مغطّاة باختبار في tests/unit/commission.test.ts.
 */

export type AffiliateTierName = "BRONZE" | "SILVER" | "GOLD";

export type CommissionSettings = {
  /** النسبة العامة حين لا تحدّد الخدمة نسبتها. */
  defaultBps: number;
  /** سقف لا تتجاوزه أي نسبة مهما تراكمت المكافآت. */
  maxBps: number;
  /** مكافأة المستوى تُضاف فوق نسبة الخدمة. */
  tierBonusBps: Record<AffiliateTierName, number>;
  /** عتبات الترقية بمجموع المبيعات المعتمدة (هللات). */
  tierThresholds: { silver: number; gold: number };
  /** مدة تثبيت العمولة بعد اكتمال الطلب قبل جواز اعتمادها (أيام). */
  holdDays: number;
  /** نافذة نسب الزيارة للمسوّق بعد النقر (أيام). */
  attributionWindowDays: number;
  /** أقل رصيد معتمد يجوز طلب سحبه (هللات). */
  minPayout: number;
};

export const DEFAULT_COMMISSION_SETTINGS: CommissionSettings = {
  defaultBps: 1500, // ١٥٪
  maxBps: 5000, // ٥٠٪ — سقف صلب يمنع خطأً إداريًا يبتلع هامش الخدمة
  tierBonusBps: { BRONZE: 0, SILVER: 200, GOLD: 500 },
  tierThresholds: { silver: 1_000_000, gold: 5_000_000 }, // ١٠٬٠٠٠ و ٥٠٬٠٠٠ ريال
  holdDays: 14,
  attributionWindowDays: 30,
  minPayout: 20_000, // ٢٠٠ ريال
};

export function clampBps(bps: number, maxBps: number): number {
  if (!Number.isFinite(bps)) return 0;
  return Math.min(Math.max(Math.round(bps), 0), maxBps);
}

/**
 * ترتيب الأولوية:
 *   1) نسبة تفاوضية للمسوّق — تُلغي كل ما عداها (لا تُضاف إليها مكافأة المستوى،
 *      وإلا لانفلتت النسبة المتّفق عليها).
 *   2) نسبة الخدمة إن وُجدت، وإلا النسبة العامة — ثم تُضاف مكافأة المستوى.
 * والنتيجة محصورة دائمًا بين صفر والسقف.
 */
export function resolveRateBps(input: {
  affiliateCustomBps?: number | null;
  serviceBps?: number | null;
  tier: AffiliateTierName;
  settings: CommissionSettings;
}): number {
  const { affiliateCustomBps, serviceBps, tier, settings } = input;

  if (affiliateCustomBps != null) {
    return clampBps(affiliateCustomBps, settings.maxBps);
  }

  const base = serviceBps ?? settings.defaultBps;
  const bonus = settings.tierBonusBps[tier] ?? 0;
  return clampBps(base + bonus, settings.maxBps);
}

/**
 * وعاء العمولة هو ما دفعه العميل فعلًا (الإجمالي بعد الخصم)، لا السعر المعلن:
 * الكوبون خصمٌ من إيراد المنصّة، فلا يُحتسب على مبلغ لم يدخل الصندوق.
 */
export function commissionBase(order: { total: number }): number {
  return Math.max(0, Math.trunc(order.total));
}

/** التقريب لأسفل دائمًا — الهللة الكسرية لصالح المنصّة لا لصالح فرق تقريب عشوائي. */
export function calculateCommission(baseAmount: number, rateBps: number): number {
  if (baseAmount <= 0 || rateBps <= 0) return 0;
  return Math.floor((Math.trunc(baseAmount) * Math.round(rateBps)) / 10_000);
}

/** المستوى المستحق بناءً على مجموع المبيعات المعتمدة. */
export function tierForSales(
  approvedSalesHalalas: number,
  settings: CommissionSettings = DEFAULT_COMMISSION_SETTINGS,
): AffiliateTierName {
  if (approvedSalesHalalas >= settings.tierThresholds.gold) return "GOLD";
  if (approvedSalesHalalas >= settings.tierThresholds.silver) return "SILVER";
  return "BRONZE";
}

/** المبلغ الناقص للوصول إلى المستوى التالي، وnull عند أعلى مستوى. */
export function nextTierGap(
  approvedSalesHalalas: number,
  settings: CommissionSettings = DEFAULT_COMMISSION_SETTINGS,
): { tier: AffiliateTierName; remaining: number } | null {
  if (approvedSalesHalalas < settings.tierThresholds.silver) {
    return { tier: "SILVER", remaining: settings.tierThresholds.silver - approvedSalesHalalas };
  }
  if (approvedSalesHalalas < settings.tierThresholds.gold) {
    return { tier: "GOLD", remaining: settings.tierThresholds.gold - approvedSalesHalalas };
  }
  return null;
}

/** تاريخ استحقاق اعتماد العمولة = اكتمال الطلب + مدة التثبيت. */
export function maturityDate(completedAt: Date, settings: CommissionSettings): Date {
  return new Date(completedAt.getTime() + settings.holdDays * 24 * 60 * 60 * 1000);
}

export function isMature(maturesAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!maturesAt) return false;
  return maturesAt.getTime() <= now.getTime();
}

/** هل ما تزال نقرة الإحالة صالحة لنسب الطلب للمسوّق؟ */
export function isClickWithinWindow(
  clickedAt: Date,
  now: Date,
  windowDays: number,
): boolean {
  const elapsed = now.getTime() - clickedAt.getTime();
  if (elapsed < 0) return false;
  return elapsed <= windowDays * 24 * 60 * 60 * 1000;
}

/**
 * حين يجتمع كوبون مسوّق مع كوكي مسوّق آخر: الكوبون يفوز.
 * كتابة العميل للكود فعل صريح ينسب البيع لصاحبه، بينما الكوكي أثر سابق قد يكون
 * لزيارة عابرة — وهذا يمنع «سرقة» البيع بكوكي قديم ممّن دلّ العميل فعلًا.
 */
export function resolveAttribution(input: {
  couponAffiliateId?: string | null;
  cookieAffiliateId?: string | null;
}): { affiliateId: string | null; source: "NONE" | "LINK" | "COUPON" } {
  if (input.couponAffiliateId) {
    return { affiliateId: input.couponAffiliateId, source: "COUPON" };
  }
  if (input.cookieAffiliateId) {
    return { affiliateId: input.cookieAffiliateId, source: "LINK" };
  }
  return { affiliateId: null, source: "NONE" };
}

export type CommissionLike = {
  status: "PENDING" | "APPROVED" | "PAID" | "CANCELLED";
  amount: number;
  payoutId?: string | null;
};

/** ملخّص أرصدة المسوّق كما تُعرض في لوحته. */
export function summarizeBalances(commissions: CommissionLike[]) {
  let pending = 0;
  let available = 0;
  let reserved = 0;
  let paid = 0;

  for (const c of commissions) {
    if (c.status === "PENDING") pending += c.amount;
    else if (c.status === "APPROVED") {
      // المعتمدة المرتبطة بطلب سحب قائم محجوزة، فلا تُحتسب مرتين.
      if (c.payoutId) reserved += c.amount;
      else available += c.amount;
    } else if (c.status === "PAID") paid += c.amount;
  }

  return { pending, available, reserved, paid, lifetime: available + reserved + paid };
}

export function canRequestPayout(
  availableHalalas: number,
  settings: CommissionSettings,
): { ok: true } | { ok: false; reason: string } {
  if (availableHalalas <= 0) {
    return { ok: false, reason: "لا يوجد رصيد معتمد قابل للسحب حتى الآن." };
  }
  if (availableHalalas < settings.minPayout) {
    return {
      ok: false,
      reason: `أقل مبلغ للسحب ${settings.minPayout / 100} ر.س، ورصيدك المعتمد ${
        availableHalalas / 100
      } ر.س.`,
    };
  }
  return { ok: true };
}
