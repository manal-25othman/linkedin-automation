import "server-only";

import { mockProvider } from "@/lib/payments/mock";
import { moyasarProvider } from "@/lib/payments/moyasar";
import type { CheckoutInput, CheckoutSession } from "@/lib/payments/types";

export type { CheckoutInput, CheckoutSession };

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function isMockPaymentsAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_PAYMENTS === "true";
}

function selectProvider() {
  const configured = process.env.PAYMENT_PROVIDER?.trim().toLowerCase();
  if (configured === "moyasar") return moyasarProvider;
  return mockProvider;
}

/** ينشئ جلسة دفع ويُعيد العنوان الذي يُحوَّل إليه العميل. */
export async function createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
  const provider = selectProvider();
  const returnUrl = `${getSiteUrl()}/orders/${input.orderNumber}?k=${input.trackingKey}`;
  return provider.createCheckout(input, returnUrl);
}

export function activeProviderName(): string {
  return selectProvider().name;
}
