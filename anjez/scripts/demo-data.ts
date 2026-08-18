/**
 * بيانات عرض للتطوير: طلبات في حالات مختلفة منسوبة للمسوّق التجريبي، ونقرات،
 * وعمولات معلّقة/معتمدة/مصروفة — حتى تظهر اللوحات بمحتوى واقعي بدل جداول فارغة.
 *
 * للتطوير فقط: `npx tsx scripts/demo-data.ts`
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CUSTOMERS = [
  ["نورة العتيبي", "+966501111111"],
  ["فهد الشمري", "+966502222222"],
  ["مها القحطاني", "+966503333333"],
  ["سعد الدوسري", "+966504444444"],
  ["ريم الغامدي", "+966505555555"],
  ["خالد الحربي", "+966506666666"],
] as const;

function code(length: number) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("لا تُشغَّل بيانات العرض في الإنتاج.");
  }

  const affiliate = await prisma.affiliate.findFirst({
    where: { code: "ANJEZ1" },
    select: { id: true, tier: true },
  });
  const tiers = await prisma.serviceTier.findMany({
    where: { isActive: true },
    select: { id: true, price: true, serviceId: true },
    take: 8,
  });

  if (!affiliate || tiers.length === 0) {
    throw new Error("شغّل `npm run db:seed` أولًا.");
  }

  await prisma.order.deleteMany({ where: { customerName: { in: CUSTOMERS.map((c) => c[0]) } } });

  const plans = [
    { status: "COMPLETED", commission: "PAID", daysAgo: 40 },
    { status: "COMPLETED", commission: "APPROVED", daysAgo: 25 },
    { status: "COMPLETED", commission: "APPROVED", daysAgo: 20 },
    { status: "DELIVERED", commission: "PENDING", daysAgo: 6 },
    { status: "IN_PROGRESS", commission: "PENDING", daysAgo: 3 },
    { status: "PENDING_PAYMENT", commission: null, daysAgo: 1 },
  ] as const;

  for (const [index, plan] of plans.entries()) {
    const tier = tiers[index % tiers.length];
    const [name, phone] = CUSTOMERS[index];
    const createdAt = new Date(Date.now() - plan.daysAgo * 24 * 60 * 60 * 1000);
    const isPaid = plan.status !== "PENDING_PAYMENT";

    const order = await prisma.order.create({
      data: {
        orderNumber: `ANJ-${String(createdAt.getFullYear()).slice(2)}${String(
          createdAt.getMonth() + 1,
        ).padStart(2, "0")}-${code(6)}`,
        trackingKey: code(10),
        serviceId: tier.serviceId,
        tierId: tier.id,
        customerName: name,
        customerPhone: phone,
        notes: "تفاصيل الطلب كما أرسلها العميل.",
        subtotal: tier.price,
        total: tier.price,
        status: plan.status,
        affiliateId: affiliate.id,
        attribution: "LINK",
        paymentProvider: isPaid ? "mock" : null,
        paymentReference: isPaid ? `mock_${code(8)}` : null,
        paidAt: isPaid ? createdAt : null,
        completedAt: plan.status === "COMPLETED" ? createdAt : null,
        createdAt,
      },
      select: { id: true },
    });

    await prisma.orderEvent.create({
      data: { orderId: order.id, to: plan.status, actor: "demo", createdAt },
    });

    if (plan.commission) {
      const rateBps = 1500;
      await prisma.commission.create({
        data: {
          orderId: order.id,
          affiliateId: affiliate.id,
          baseAmount: tier.price,
          rateBps,
          amount: Math.floor((tier.price * rateBps) / 10_000),
          status: plan.commission,
          maturesAt: plan.status === "COMPLETED" ? createdAt : null,
          approvedAt: plan.commission === "PENDING" ? null : createdAt,
          paidAt: plan.commission === "PAID" ? createdAt : null,
          createdAt,
        },
      });
    }
  }

  // نقرات تجعل نسبة التحويل رقمًا ذا معنى في اللوحة.
  await prisma.referralClick.deleteMany({ where: { affiliateId: affiliate.id } });
  await prisma.referralClick.createMany({
    data: Array.from({ length: 47 }, (_, i) => ({
      affiliateId: affiliate.id,
      code: "ANJEZ1",
      landingPath: i % 3 === 0 ? "/" : "/services/certified-translation",
      createdAt: new Date(Date.now() - (i % 30) * 24 * 60 * 60 * 1000),
    })),
  });

  await prisma.coupon.upsert({
    where: { code: "NOURA10" },
    create: {
      code: "NOURA10",
      affiliateId: affiliate.id,
      type: "PERCENT",
      value: 1000,
      isActive: true,
    },
    update: {},
  });

  console.log("جاهزة: ٦ طلبات، ٥ عمولات، ٤٧ نقرة، وكود خصم NOURA10.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
