export type CheckoutInput = {
  orderNumber: string;
  trackingKey: string;
  /** بالهللات. */
  amount: number;
  description: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
};

export type CheckoutSession = {
  provider: string;
  reference: string;
  /** العنوان الذي يُحوَّل إليه العميل لإتمام الدفع. */
  url: string;
};

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput, returnUrl: string): Promise<CheckoutSession>;
}
