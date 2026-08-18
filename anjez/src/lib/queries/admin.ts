import "server-only";

import { prisma } from "@/lib/prisma";

/** مؤشّرات اللوحة الرئيسية — استعلامات متوازية، وكل رقم مستقلّ عن الآخر. */
export async function getAdminOverview() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    ordersTotal,
    ordersMonth,
    revenue,
    revenueMonth,
    pendingOrders,
    affiliatesPending,
    affiliatesActive,
    commissionPending,
    commissionApproved,
    payoutsRequested,
    referredOrders,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.order.aggregate({
      where: { status: { in: ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] } },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: monthStart },
        status: { in: ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] },
      },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { status: { in: ["PAID", "IN_PROGRESS"] } } }),
    prisma.affiliate.count({ where: { status: "PENDING" } }),
    prisma.affiliate.count({ where: { status: "ACTIVE" } }),
    prisma.commission.aggregate({ where: { status: "PENDING" }, _sum: { amount: true } }),
    prisma.commission.aggregate({ where: { status: "APPROVED" }, _sum: { amount: true } }),
    prisma.payout.count({ where: { status: { in: ["REQUESTED", "PROCESSING"] } } }),
    prisma.order.count({
      where: {
        affiliateId: { not: null },
        status: { in: ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] },
      },
    }),
  ]);

  const paidOrders = await prisma.order.count({
    where: { status: { in: ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] } },
  });

  return {
    ordersTotal,
    ordersMonth,
    revenue: revenue._sum.total ?? 0,
    revenueMonth: revenueMonth._sum.total ?? 0,
    pendingOrders,
    affiliatesPending,
    affiliatesActive,
    commissionPending: commissionPending._sum.amount ?? 0,
    commissionApproved: commissionApproved._sum.amount ?? 0,
    payoutsRequested,
    referredShare: paidOrders > 0 ? Math.round((referredOrders / paidOrders) * 100) : 0,
  };
}

export async function getTopAffiliates(take = 5) {
  const grouped = await prisma.commission.groupBy({
    by: ["affiliateId"],
    where: { status: { in: ["APPROVED", "PAID"] } },
    _sum: { amount: true, baseAmount: true },
    orderBy: { _sum: { amount: "desc" } },
    take,
  });

  if (grouped.length === 0) return [];

  const affiliates = await prisma.affiliate.findMany({
    where: { id: { in: grouped.map((row) => row.affiliateId) } },
    select: { id: true, code: true, tier: true, user: { select: { name: true } } },
  });

  const byId = new Map(affiliates.map((affiliate) => [affiliate.id, affiliate]));

  return grouped.map((row) => ({
    affiliate: byId.get(row.affiliateId),
    commission: row._sum.amount ?? 0,
    sales: row._sum.baseAmount ?? 0,
  }));
}

export async function listOrders(status?: string) {
  return prisma.order.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerPhone: true,
      total: true,
      status: true,
      attribution: true,
      createdAt: true,
      service: { select: { title: true } },
      tier: { select: { name: true } },
      affiliate: { select: { code: true } },
    },
  });
}
