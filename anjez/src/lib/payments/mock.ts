import type { CheckoutInput, CheckoutSession, PaymentProvider } from "@/lib/payments/types";

/**
 * مزوّد تجريبي للتطوير: يعرض صفحة داخلية بزرَّي «دفع ناجح» و«فشل الدفع» بدل
 * الانتقال لبوّابة حقيقية، فتُختبر دورة الطلب والعمولة كاملة بلا حساب تاجر.
 * صفحته ترفض العمل في الإنتاج ما لم يُفعَّل ALLOW_MOCK_PAYMENTS صراحةً.
 */
export const mockProvider: PaymentProvider = {
  name: "mock",

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    return {
      provider: "mock",
      reference: `mock_${input.orderNumber}`,
      url: `/checkout/${input.orderNumber}?k=${input.trackingKey}`,
    };
  },
};
