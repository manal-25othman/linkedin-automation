import "server-only";

import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { generateOrderNumber, randomCode } from "@/lib/affiliate/codes";
import {
  calculateCommission,
  commissionBase,
  maturityDate,
  resolveAttribution,
  resolveRateBps,
} from "@/lib/affiliate/commission";
import { evaluateCoupon } from "@/lib/affiliate/coupons";

export type CreateOrderInput = {
  tierId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
  couponCode: string;
  cookieAffiliateId: string | null;
};

export type CreateOrderResult =
  | { ok: true; orderNumber: string; trackingKey: string; total: number }
  | { ok: false; error: string; field?: string };

/**
 * ينشئ الطلب ويقفل عليه: السعر، والخصم، والمسوّق المنسوب إليه.
 * القفل مقصود — تغيير سعر الخدمة أو نسبتها لاحقًا يجب ألا يغيّر طلبًا قائمًا
 * ولا عمولةً وُعد بها مسوّق.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const tier = await prisma.serviceTier.findUnique({
    where: { id: input.tierId },
    select: {
      id: true,
      price: true,
      isActive: true,
      service: { select: { id: true, isActive: true, title: true } },
    },
  });

  if (!tier || !tier.isActive || !tier.service.isActive) {
    return { ok: false, error: "هذه الباقة لم تعد متاحة.", field: "tierId" };
  }

  const subtotal = tier.price;
  let discount = 0;
  let couponId: string | null = null;
  let couponAffiliateId: string | null = null;

  if (input.couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: input.couponCode } });
    const check = evaluateCoupon(coupon, subtotal);
    if (!check.ok) {
      return { ok: false, error: check.reason, field: "couponCode" };
    }
    discount = check.discount;
    couponId = coupon!.id;
    couponAffiliateId = coupon!.affiliateId;
  }

  // كوبون مسوّق موقوف لا يمنح خصمًا باسمه: نتحقّق من حالته قبل النسب.
  if (couponAffiliateId) {
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: couponAffiliateId },
      select: { status: true },
    });
    if (affiliate?.status !== "ACTIVE") couponAffiliateId = null;
  }

  const attribution = resolveAttribution({
    couponAffiliateId,
    cookieAffiliateId: input.cookieAffiliateId,
  });

  const total = Math.max(0, subtotal - discount);

  // إعادة المحاولة تغطي التصادم النادر في رقم الطلب العشوائي.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            trackingKey: randomCode(10),
            serviceId: tier.service.id,
            tierId: tier.id,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            customerEmail: input.customerEmail || null,
            notes: input.notes,
            subtotal,
            discount,
            total,
            affiliateId: attribution.affiliateId,
            couponId,
            attribution: attribution.source,
          },
          select: { id: true, orderNumber: true, trackingKey: true, total: true },
        });

        await tx.orderEvent.create({
          data: { orderId: created.id, to: "PENDING_PAYMENT", actor: "customer" },
        });

        return created;
      });

      return {
        ok: true,
        orderNumber: order.orderNumber,
        trackingKey: order.trackingKey,
        total: order.total,
      };
    } catch (error) {
      const isUniqueClash =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!isUniqueClash) {
        return { ok: false, error: "تعذّر إنشاء الطلب. حاول مرة أخرى." };
      }
    }
  }

  return { ok: false, error: "تعذّر إنشاء الطلب. حاول مرة أخرى." };
}

/**
 * تُستدعى من webhook الدفع ومن صفحة الدفع التجريبية. مُصمَّمة لتكون idempotent:
 * بوّابات الدفع تُعيد إرسال نفس الإشعار عند أي تأخّر في الرد، وتنفيذها مرتين
 * يجب ألا يُنتج عمولتين على بيع واحد.
 */
export async function markOrderPaid(
  orderNumber: string,
  payment: { provider: string; reference: string },
): Promise<{ ok: boolean; alreadyPaid?: boolean }> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      status: true,
      total: true,
      couponId: true,
      affiliateId: true,
      service: { select: { commissionBps: true } },
      affiliate: { select: { customBps: true, tier: true, status: true } },
      commission: { select: { id: true } },
    },
  });

  if (!order) return { ok: false };
  if (order.status !== "PENDING_PAYMENT") {
    return { ok: true, alreadyPaid: true };
  }

  const { commission: settings } = await getSettings();

  const shouldCreateCommission =
    order.affiliateId != null &&
    order.affiliate?.status === "ACTIVE" &&
    order.commission == null;

  const rateBps = shouldCreateCommission
    ? resolveRateBps({
        affiliateCustomBps: order.affiliate?.customBps ?? null,
        serviceBps: order.service.commissionBps,
        tier: order.affiliate?.tier ?? "BRONZE",
        settings,
      })
    : 0;

  const base = commissionBase({ total: order.total });
  const amount = calculateCommission(base, rateBps);

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentProvider: payment.provider,
        paymentReference: payment.reference,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        from: "PENDING_PAYMENT",
        to: "PAID",
        actor: payment.provider,
        note: payment.reference,
      },
    });

    if (order.couponId) {
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { increment: 1 } },
      });
    }

    if (shouldCreateCommission && amount > 0) {
      await tx.commission.create({
        data: {
          orderId: order.id,
          affiliateId: order.affiliateId!,
          baseAmount: base,
          rateBps,
          amount,
        },
      });
    }
  });

  return { ok: true };
}

/**
 * «مدفوع» ليست انتقالًا يدويًّا: تسجيل الدفع يمرّ دائمًا عبر `markOrderPaid`
 * لأنه وحده يُنشئ العمولة ويزيد عدّاد الكوبون. لو سُمح بها هنا لضاعت عمولة
 * المسوّق في كل طلب يُؤكَّد يدويًّا.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PAID: ["IN_PROGRESS", "CANCELLED", "REFUNDED"],
  IN_PROGRESS: ["DELIVERED", "CANCELLED", "REFUNDED"],
  DELIVERED: ["COMPLETED", "REFUNDED"],
  COMPLETED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * تغيير حالة الطلب من اللوحة، ومعه أثره على العمولة:
 *  - COMPLETED يبدأ عدّاد التثبيت (maturesAt).
 *  - CANCELLED/REFUNDED يُلغي عمولةً لم تُصرف بعد؛ أما المصروفة فتبقى وتُسجَّل
 *    ملاحظة — استرجاع مبلغ صُرف فعلًا قرار إداري لا يُنفَّذ بصمت من كود الحالة.
 */
export async function updateOrderStatus(
  orderId: string,
  to: OrderStatus,
  actor: string,
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, commission: { select: { id: true, status: true } } },
  });

  if (!order) return { ok: false, error: "الطلب غير موجود." };
  if (order.status === to) return { ok: true };
  if (!canTransition(order.status, to)) {
    return { ok: false, error: "لا يمكن الانتقال إلى هذه الحالة من الحالة الحالية." };
  }

  const { commission: settings } = await getSettings();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: to,
        completedAt: to === "COMPLETED" ? now : undefined,
        cancelledAt: to === "CANCELLED" || to === "REFUNDED" ? now : undefined,
      },
    });

    await tx.orderEvent.create({
      data: { orderId: order.id, from: order.status, to, actor, note: note ?? null },
    });

    if (!order.commission) return;

    if (to === "COMPLETED" && order.commission.status === "PENDING") {
      await tx.commission.update({
        where: { id: order.commission.id },
        data: { maturesAt: maturityDate(now, settings) },
      });
    }

    if (to === "CANCELLED" || to === "REFUNDED") {
      if (order.commission.status === "PENDING" || order.commission.status === "APPROVED") {
        await tx.commission.update({
          where: { id: order.commission.id },
          data: {
            status: "CANCELLED",
            note: to === "REFUNDED" ? "أُلغيت لاسترجاع مبلغ الطلب" : "أُلغيت لإلغاء الطلب",
          },
        });
      } else if (order.commission.status === "PAID") {
        await tx.commission.update({
          where: { id: order.commission.id },
          data: { note: "الطلب أُلغي بعد صرف العمولة — يحتاج تسوية يدوية" },
        });
      }
    }
  });

  return { ok: true };
}

/**
 * يعتمد العمولات التي انقضت مدّة تثبيتها. تُستدعى من مهمّة مجدولة ومن لوحة
 * الأدمن، فتبقى الأرصدة صحيحة حتى لو تعطّلت المهمّة.
 */
export async function approveDueCommissions(): Promise<number> {
  const settings = await getSettings();
  if (!settings.autoApprove) return 0;

  const result = await prisma.commission.updateMany({
    where: { status: "PENDING", maturesAt: { not: null, lte: new Date() } },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  return result.count;
}
