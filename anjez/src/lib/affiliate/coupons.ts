/** حساب خصم الكوبون — دوال نقية. المبالغ بالهللات والنِسَب بنقاط الأساس. */

export type CouponLike = {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  isActive: boolean;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | null;
};

export type CouponCheck =
  | { ok: true; discount: number }
  | { ok: false; reason: string };

/**
 * الخصم لا يتجاوز قيمة الطلب أبدًا: كوبون ثابت بمئة ريال على طلب بخمسين
 * يجب أن ينتهي بصفر لا بمبلغ سالب يُحوّل الطلب إلى دَين على المنصّة.
 */
export function evaluateCoupon(
  coupon: CouponLike | null | undefined,
  subtotal: number,
  now: Date = new Date(),
): CouponCheck {
  if (!coupon) return { ok: false, reason: "كود الخصم غير صحيح." };
  if (!coupon.isActive) return { ok: false, reason: "كود الخصم متوقّف." };
  if (coupon.expiresAt && coupon.expiresAt.getTime() < now.getTime()) {
    return { ok: false, reason: "انتهت صلاحية كود الخصم." };
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, reason: "استُنفد عدد مرات استخدام هذا الكود." };
  }

  const raw =
    coupon.type === "PERCENT"
      ? Math.floor((subtotal * coupon.value) / 10_000)
      : coupon.value;

  const discount = Math.min(Math.max(0, raw), subtotal);
  if (discount <= 0) return { ok: false, reason: "هذا الكود لا يمنح خصمًا على هذا الطلب." };

  return { ok: true, discount };
}

export function describeCoupon(coupon: CouponLike): string {
  return coupon.type === "PERCENT"
    ? `خصم ${coupon.value / 100}٪`
    : `خصم ${coupon.value / 100} ر.س`;
}
