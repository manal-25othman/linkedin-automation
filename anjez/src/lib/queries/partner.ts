import "server-only";

import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { summarizeBalances, tierForSales } from "@/lib/affiliate/commission";

export type AffiliateProfile = NonNullable<Awaited<ReturnType<typeof getAffiliateProfile>>>;

export async function getAffiliateProfile(userId: string) {
  return prisma.affiliate.findUnique({
    where: { userId },
    select: {
      id: true,
      code: true,
      status: true,
      tier: true,
      customBps: true,
      payoutMethod: true,
      beneficiaryName: true,
      iban: true,
      bankName: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });
}

/**
 * يعيد حساب المستوى من المبيعات المعتمدة ويحدّثه عند التغيّر.
 * الترقية عند القراءة لا بمهمّة مجدولة: المسوّق يرى مستواه صحيحًا لحظة فتح
 * لوحته، ولا يعتمد استحقاقه على مهمّة قد تتعطّل.
 */
export async function syncAffiliateTier(affiliateId: string, currentTier: string) {
  const settings = await getSettings();

  const sales = await prisma.commission.aggregate({
    where: { affiliateId, status: { in: ["APPROVED", "PAID"] } },
    _sum: { baseAmount: true },
  });

  const approvedSales = sales._sum.baseAmount ?? 0;
  const tier = tierForSales(approvedSales, settings.commission);

  if (tier !== currentTier) {
    await prisma.affiliate
      .update({ where: { id: affiliateId }, data: { tier } })
      .catch(() => undefined);
  }

  return { tier, approvedSales };
}

export async function getAffiliateStats(affiliateId: string) {
  const [clicks, orders, paidOrders, commissions] = await Promise.all([
    prisma.referralClick.count({ where: { affiliateId } }),
    prisma.order.count({ where: { affiliateId } }),
    prisma.order.count({
      where: { affiliateId, status: { in: ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] } },
    }),
    prisma.commission.findMany({
      where: { affiliateId },
      select: { amount: true, status: true, payoutId: true },
    }),
  ]);

  const balances = summarizeBalances(commissions);
  const conversionRate = clicks > 0 ? Math.round((paidOrders / clicks) * 1000) / 10 : 0;

  return { clicks, orders, paidOrders, conversionRate, balances };
}

export async function getAffiliateCommissions(affiliateId: string, take = 100) {
  return prisma.commission.findMany({
    where: { affiliateId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      amount: true,
      baseAmount: true,
      rateBps: true,
      status: true,
      maturesAt: true,
      createdAt: true,
      order: {
        select: {
          orderNumber: true,
          status: true,
          attribution: true,
          service: { select: { title: true } },
        },
      },
    },
  });
}

export async function getAffiliatePayouts(affiliateId: string) {
  return prisma.payout.findMany({
    where: { affiliateId },
    orderBy: { requestedAt: "desc" },
    select: {
      id: true,
      amount: true,
      status: true,
      reference: true,
      note: true,
      requestedAt: true,
      processedAt: true,
      _count: { select: { commissions: true } },
    },
  });
}

export async function getAffiliateCoupons(affiliateId: string) {
  return prisma.coupon.findMany({
    where: { affiliateId, isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      code: true,
      type: true,
      value: true,
      usedCount: true,
      maxUses: true,
      expiresAt: true,
    },
  });
}
