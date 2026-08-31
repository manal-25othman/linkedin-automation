/**
 * اختبار تكاملي على قاعدة بيانات حقيقية: من إنشاء الطلب إلى اعتماد العمولة.
 * يتخطّى نفسه إن لم يوجد DATABASE_URL، فلا يكسر بيئة بلا قاعدة.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createOrder, markOrderPaid, updateOrderStatus, approveDueCommissions } from "@/lib/orders";
import { calculateCommission, resolveRateBps, DEFAULT_COMMISSION_SETTINGS } from "@/lib/affiliate/commission";

const hasDb = Boolean(process.env.DATABASE_URL);
const prisma = new PrismaClient();

const suite = hasDb ? describe : describe.skip;

suite("دورة الطلب والعمولة", () => {
  let tierId = "";
  let servicePrice = 0;
  let affiliateId = "";
  let affiliateTier: "BRONZE" | "SILVER" | "GOLD" = "BRONZE";
  let affiliateCustomBps: number | null = null;
  let serviceCommissionBps: number | null = null;
  const createdOrderNumbers: string[] = [];

  beforeAll(async () => {
    const tier = await prisma.serviceTier.findFirst({
      where: { isActive: true, service: { isActive: true } },
      select: { id: true, price: true, service: { select: { commissionBps: true } } },
    });

    const affiliate = await prisma.affiliate.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true, tier: true, customBps: true },
    });

    if (!tier || !affiliate) {
      throw new Error("شغّل `npm run db:seed` قبل الاختبار التكاملي.");
    }

    tierId = tier.id;
    servicePrice = tier.price;
    serviceCommissionBps = tier.service.commissionBps;
    affiliateId = affiliate.id;
    // المستوى يُقرأ من الحساب لا يُفترض: بيانات العرض قد ترقّيه، والاختبار يتحقّق
    // من قاعدة الاحتساب لا من قيمة ثابتة.
    affiliateTier = affiliate.tier;
    affiliateCustomBps = affiliate.customBps;
  });

  afterAll(async () => {
    if (createdOrderNumbers.length > 0) {
      await prisma.order.deleteMany({ where: { orderNumber: { in: createdOrderNumbers } } });
    }
    await prisma.$disconnect();
  });

  it("ينشئ طلبًا منسوبًا للمسوّق، ثم يُنشئ عمولة عند الدفع، ويعتمدها بعد الاكتمال", async () => {
    const created = await createOrder({
      tierId,
      customerName: "عميل اختبار",
      customerPhone: "+966500000001",
      customerEmail: "",
      notes: "طلب اختباري",
      couponCode: "",
      cookieAffiliateId: affiliateId,
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdOrderNumbers.push(created.orderNumber);

    const beforePayment = await prisma.order.findUnique({
      where: { orderNumber: created.orderNumber },
      select: { status: true, attribution: true, affiliateId: true, commission: true },
    });

    // لا عمولة قبل الدفع: النقر وحده لا يستحقّ شيئًا.
    expect(beforePayment?.status).toBe("PENDING_PAYMENT");
    expect(beforePayment?.attribution).toBe("LINK");
    expect(beforePayment?.affiliateId).toBe(affiliateId);
    expect(beforePayment?.commission).toBeNull();

    const paid = await markOrderPaid(created.orderNumber, {
      provider: "test",
      reference: "test_ref_1",
    });
    expect(paid.ok).toBe(true);

    const afterPayment = await prisma.order.findUnique({
      where: { orderNumber: created.orderNumber },
      select: {
        id: true,
        status: true,
        commission: { select: { id: true, amount: true, rateBps: true, status: true, maturesAt: true } },
      },
    });

    expect(afterPayment?.status).toBe("PAID");
    expect(afterPayment?.commission).not.toBeNull();

    const expectedRate = resolveRateBps({
      affiliateCustomBps,
      serviceBps: serviceCommissionBps,
      tier: affiliateTier,
      settings: DEFAULT_COMMISSION_SETTINGS,
    });
    expect(afterPayment?.commission?.rateBps).toBe(expectedRate);
    expect(afterPayment?.commission?.amount).toBe(
      calculateCommission(servicePrice, expectedRate),
    );
    expect(afterPayment?.commission?.status).toBe("PENDING");
    // مدّة التثبيت لا تبدأ إلا باكتمال الخدمة.
    expect(afterPayment?.commission?.maturesAt).toBeNull();

    // إعادة إرسال إشعار الدفع (كما تفعل البوّابات) لا تُنشئ عمولة ثانية.
    const replay = await markOrderPaid(created.orderNumber, {
      provider: "test",
      reference: "test_ref_1",
    });
    expect(replay.alreadyPaid).toBe(true);
    expect(await prisma.commission.count({ where: { orderId: afterPayment!.id } })).toBe(1);

    const orderId = afterPayment!.id;
    await updateOrderStatus(orderId, "IN_PROGRESS", "test");
    await updateOrderStatus(orderId, "DELIVERED", "test");
    await updateOrderStatus(orderId, "COMPLETED", "test");

    const matured = await prisma.commission.findUnique({
      where: { orderId },
      select: { maturesAt: true, status: true },
    });
    expect(matured?.maturesAt).toBeInstanceOf(Date);
    expect(matured?.status).toBe("PENDING");

    // لم يحن موعد الاستحقاق بعد، فلا اعتماد.
    await approveDueCommissions();
    expect((await prisma.commission.findUnique({ where: { orderId } }))?.status).toBe("PENDING");

    // نُقدّم تاريخ الاستحقاق لمحاكاة انقضاء مدّة التثبيت.
    await prisma.commission.update({
      where: { orderId },
      data: { maturesAt: new Date(Date.now() - 1000) },
    });
    await approveDueCommissions();
    expect((await prisma.commission.findUnique({ where: { orderId } }))?.status).toBe("APPROVED");
  });

  it("إلغاء الطلب بعد الدفع يُلغي العمولة", async () => {
    const created = await createOrder({
      tierId,
      customerName: "عميل ملغى",
      customerPhone: "+966500000002",
      customerEmail: "",
      notes: "",
      couponCode: "",
      cookieAffiliateId: affiliateId,
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdOrderNumbers.push(created.orderNumber);

    await markOrderPaid(created.orderNumber, { provider: "test", reference: "test_ref_2" });

    const order = await prisma.order.findUnique({
      where: { orderNumber: created.orderNumber },
      select: { id: true },
    });

    await updateOrderStatus(order!.id, "REFUNDED", "test", "اختبار الاسترجاع");

    const commission = await prisma.commission.findUnique({
      where: { orderId: order!.id },
      select: { status: true },
    });
    expect(commission?.status).toBe("CANCELLED");
  });

  it("التحويل البنكي اليدوي: لا حالة مدفوعة إلا بتأكيد، والعمولة تُنشأ عنده", async () => {
    const created = await createOrder({
      tierId,
      customerName: "عميل تحويل بنكي",
      customerPhone: "+966500000004",
      customerEmail: "",
      notes: "",
      couponCode: "",
      cookieAffiliateId: affiliateId,
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdOrderNumbers.push(created.orderNumber);

    const order = await prisma.order.findUnique({
      where: { orderNumber: created.orderNumber },
      select: { id: true, status: true },
    });

    // إنشاء الطلب وحده لا يُنشئ عمولة: لا مال وصل بعد.
    expect(order?.status).toBe("PENDING_PAYMENT");
    expect(await prisma.commission.count({ where: { orderId: order!.id } })).toBe(0);

    // تغيير الحالة يدويًّا إلى «مدفوع» ممنوع — وإلا ضاعت عمولة المسوّق.
    const manualStatus = await updateOrderStatus(order!.id, "PAID", "admin@test");
    expect(manualStatus.ok).toBe(false);
    expect(await prisma.commission.count({ where: { orderId: order!.id } })).toBe(0);

    // المسار الصحيح: تأكيد استلام الحوالة يمرّ بـ markOrderPaid.
    const confirmed = await markOrderPaid(created.orderNumber, {
      provider: "manual",
      reference: "حوالة 12345",
    });
    expect(confirmed.ok).toBe(true);

    const afterConfirm = await prisma.order.findUnique({
      where: { id: order!.id },
      select: { status: true, paymentProvider: true, commission: { select: { amount: true } } },
    });

    expect(afterConfirm?.status).toBe("PAID");
    expect(afterConfirm?.paymentProvider).toBe("manual");
    expect(afterConfirm?.commission?.amount).toBeGreaterThan(0);
  });

  it("يرفض الانتقال إلى حالة غير مسموح بها", async () => {
    const created = await createOrder({
      tierId,
      customerName: "عميل انتقال",
      customerPhone: "+966500000003",
      customerEmail: "",
      notes: "",
      couponCode: "",
      cookieAffiliateId: null,
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdOrderNumbers.push(created.orderNumber);

    const order = await prisma.order.findUnique({
      where: { orderNumber: created.orderNumber },
      select: { id: true },
    });

    // لا يُسلَّم طلب لم يُدفع.
    const result = await updateOrderStatus(order!.id, "DELIVERED", "test");
    expect(result.ok).toBe(false);
  });
});
