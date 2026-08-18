"use server";

import { redirect } from "next/navigation";
import { orderSchema, trackOrderSchema, toFieldErrors } from "@/lib/validation";
import { formError, type FormState } from "@/lib/form-state";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { getReferralContext } from "@/lib/affiliate/attribution";
import { normalizeCode } from "@/lib/affiliate/code-format";
import { createOrder } from "@/lib/orders";
import { createCheckout } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

/**
 * ينشئ الطلب ثم يحوّل العميل إلى بوّابة الدفع.
 * `redirect` يرمي استثناءً داخليًا في Next، لذا يقع خارج أي try/catch.
 */
export async function submitOrder(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await getClientIp();
  const limit = rateLimit(`order:${ip}`, 8, 10 * 60 * 1000);
  if (!limit.ok) {
    return formError("طلبات كثيرة خلال وقت قصير. انتظر قليلًا ثم أعد المحاولة.");
  }

  const parsed = orderSchema.safeParse({
    tierId: formData.get("tierId") ?? "",
    customerName: formData.get("customerName") ?? "",
    customerPhone: formData.get("customerPhone") ?? "",
    customerEmail: formData.get("customerEmail") ?? "",
    notes: formData.get("notes") ?? "",
    couponCode: formData.get("couponCode") ?? "",
  });

  if (!parsed.success) {
    return formError("تحقّق من البيانات المدخلة.", toFieldErrors(parsed.error));
  }

  const referral = await getReferralContext();

  const result = await createOrder({
    tierId: parsed.data.tierId,
    customerName: parsed.data.customerName,
    customerPhone: parsed.data.customerPhone,
    customerEmail: parsed.data.customerEmail,
    notes: parsed.data.notes,
    couponCode: parsed.data.couponCode ? normalizeCode(parsed.data.couponCode) : "",
    cookieAffiliateId: referral?.affiliateId ?? null,
  });

  if (!result.ok) {
    return formError(result.error, result.field ? { [result.field]: result.error } : {});
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: result.orderNumber },
    select: {
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      service: { select: { title: true } },
      tier: { select: { name: true } },
    },
  });

  let checkoutUrl: string;
  try {
    const checkout = await createCheckout({
      orderNumber: result.orderNumber,
      trackingKey: result.trackingKey,
      amount: result.total,
      description: `${order?.service.title ?? "خدمة"} — ${order?.tier.name ?? ""}`.trim(),
      customerName: order?.customerName ?? parsed.data.customerName,
      customerPhone: order?.customerPhone ?? parsed.data.customerPhone,
      customerEmail: order?.customerEmail,
    });
    checkoutUrl = checkout.url;
  } catch {
    // الطلب أُنشئ فعلًا؛ نأخذه إلى صفحته ليُكمل الدفع من هناك بدل ضياعه.
    checkoutUrl = `/orders/${result.orderNumber}?k=${result.trackingKey}&payment=failed`;
  }

  redirect(checkoutUrl);
}

/** تتبّع الطلب برقمه ورقم جوال صاحبه — بلا حساب ولا كلمة مرور. */
export async function trackOrder(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await getClientIp();
  const limit = rateLimit(`track:${ip}`, 20, 10 * 60 * 1000);
  if (!limit.ok) {
    return formError("محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.");
  }

  const parsed = trackOrderSchema.safeParse({
    orderNumber: formData.get("orderNumber") ?? "",
    phone: formData.get("phone") ?? "",
  });

  if (!parsed.success) {
    return formError("تحقّق من رقم الطلب ورقم الجوال.", toFieldErrors(parsed.error));
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: parsed.data.orderNumber.toUpperCase() },
    select: { orderNumber: true, customerPhone: true, trackingKey: true },
  });

  // رسالة واحدة للحالتين: رقم غير موجود، ورقم لا يطابق جواله — حتى لا يُستدلّ
  // على وجود طلب بأرقام مجرَّبة.
  if (!order || order.customerPhone !== parsed.data.phone) {
    return formError("لا يوجد طلب بهذا الرقم مرتبط بهذا الجوال.");
  }

  redirect(`/orders/${order.orderNumber}?k=${order.trackingKey}`);
}
