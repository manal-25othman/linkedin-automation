import type { CheckoutInput, CheckoutSession, PaymentProvider } from "@/lib/payments/types";

/**
 * دفع يدوي بالتحويل البنكي — للتشغيل قبل اعتماد بوّابة دفع إلكترونية
 * (حساب التاجر يتطلّب سجلًا تجاريًا وقد يتأخّر أسابيع).
 *
 * لا يدّعي الدفع: الطلب يبقى «بانتظار الدفع» حتى يؤكّد موظّف استلام الحوالة
 * من اللوحة، وعندها فقط تُنشأ العمولة. لا حالة مدفوعة بلا مال وصل فعلًا.
 */
export const manualProvider: PaymentProvider = {
  name: "manual",

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    return {
      provider: "manual",
      reference: `manual_${input.orderNumber}`,
      url: `/orders/${input.orderNumber}?k=${input.trackingKey}&payment=manual`,
    };
  },
};
