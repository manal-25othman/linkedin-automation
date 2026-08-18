"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { markOrderPaid, updateOrderStatus } from "@/lib/orders";
import { createCheckout, isMockPaymentsAllowed } from "@/lib/payments";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

/** يتحقّق أن حامل الرابط هو صاحب الطلب قبل أي إجراء عليه. */
async function loadOrderByKey(orderNumber: string, trackingKey: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      trackingKey: true,
      status: true,
      total: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      service: { select: { title: true } },
      tier: { select: { name: true } },
    },
  });

  if (!order || order.trackingKey !== trackingKey) return null;
  return order;
}

/** إعادة محاولة الدفع لطلب أُنشئ ولم يُدفع. */
export async function retryPayment(formData: FormData): Promise<void> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const trackingKey = String(formData.get("trackingKey") ?? "");

  const order = await loadOrderByKey(orderNumber, trackingKey);
  if (!order || order.status !== "PENDING_PAYMENT") {
    redirect(`/orders/${orderNumber}?k=${trackingKey}`);
  }

  const checkout = await createCheckout({
    orderNumber: order.orderNumber,
    trackingKey: order.trackingKey,
    amount: order.total,
    description: `${order.service.title} — ${order.tier.name}`,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
  });

  redirect(checkout.url);
}

/**
 * محاكاة نتيجة الدفع في بيئة التطوير. مغلقة في الإنتاج ما لم يُفعَّل
 * ALLOW_MOCK_PAYMENTS — وإلا لأصبح رابطًا يجعل أي طلب مدفوعًا بلا مال.
 */
export async function completeMockPayment(formData: FormData): Promise<void> {
  if (!isMockPaymentsAllowed()) {
    redirect("/");
  }

  const ip = await getClientIp();
  if (!rateLimit(`mockpay:${ip}`, 30, 10 * 60 * 1000).ok) {
    redirect("/");
  }

  const orderNumber = String(formData.get("orderNumber") ?? "");
  const trackingKey = String(formData.get("trackingKey") ?? "");
  const outcome = String(formData.get("outcome") ?? "success");

  const order = await loadOrderByKey(orderNumber, trackingKey);
  if (!order) redirect("/");

  if (outcome === "success") {
    await markOrderPaid(order.orderNumber, {
      provider: "mock",
      reference: `mock_${Date.now()}`,
    });
  } else if (order.status === "PENDING_PAYMENT") {
    await updateOrderStatus(order.id, "CANCELLED", "customer", "أُلغي الدفع");
  }

  redirect(`/orders/${order.orderNumber}?k=${order.trackingKey}`);
}
