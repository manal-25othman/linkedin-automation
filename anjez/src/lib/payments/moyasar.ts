import type { CheckoutInput, CheckoutSession, PaymentProvider } from "@/lib/payments/types";

const API_URL = "https://api.moyasar.com/v1/invoices";

/**
 * ميسر تقبل المبالغ بالهللات مباشرة، وهو ما نخزّنه أصلًا — فلا تحويل ولا تقريب
 * بين ما يُحسب وما يُخصم من العميل.
 */
export const moyasarProvider: PaymentProvider = {
  name: "moyasar",

  async createCheckout(input: CheckoutInput, returnUrl: string): Promise<CheckoutSession> {
    const secretKey = process.env.MOYASAR_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new Error("MOYASAR_SECRET_KEY غير مضبوط.");
    }

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: "SAR",
        description: `${input.description} — ${input.orderNumber}`,
        callback_url: returnUrl,
        metadata: {
          order_number: input.orderNumber,
          tracking_key: input.trackingKey,
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`فشل إنشاء فاتورة ميسر (${response.status}): ${body.slice(0, 200)}`);
    }

    const invoice = (await response.json()) as { id?: string; url?: string };
    if (!invoice.id || !invoice.url) {
      throw new Error("استجابة ميسر لا تحتوي على رابط الفاتورة.");
    }

    return { provider: "moyasar", reference: invoice.id, url: invoice.url };
  },
};
