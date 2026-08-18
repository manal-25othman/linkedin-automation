import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getCategories = cache(async () => {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      icon: true,
      _count: { select: { services: { where: { isActive: true } } } },
    },
  });
});

const serviceCardSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  isFeatured: true,
  category: { select: { name: true, slug: true, icon: true } },
  tiers: {
    where: { isActive: true },
    orderBy: { price: "asc" as const },
    take: 1,
    select: { price: true, deliveryDays: true },
  },
};

export type ServiceCard = Awaited<ReturnType<typeof listServices>>[number];

/** بحث بسيط بـ contains: الكتالوج بمئات الصفوف لا بملايينها، ولا يستدعي فهرسًا نصّيًا. */
export async function listServices(params: { category?: string; q?: string } = {}) {
  const { category, q } = params;

  return prisma.service.findMany({
    where: {
      isActive: true,
      ...(category ? { category: { slug: category } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { summary: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    select: serviceCardSelect,
  });
}

export const getFeaturedServices = cache(async (limit = 6) => {
  return prisma.service.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: limit,
    select: serviceCardSelect,
  });
});

export const getServiceBySlug = cache(async (slug: string) => {
  return prisma.service.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      description: true,
      requirements: true,
      category: { select: { name: true, slug: true } },
      tiers: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
        select: {
          id: true,
          name: true,
          price: true,
          deliveryDays: true,
          features: true,
        },
      },
    },
  });
});

/** إحصاءات تُعرض في الصفحة الرئيسية — تقريبية ولا تُعطّل الصفحة إن فشلت. */
export const getPublicStats = cache(async () => {
  const [services, completed, affiliates] = await Promise.all([
    prisma.service.count({ where: { isActive: true } }).catch(() => 0),
    prisma.order.count({ where: { status: "COMPLETED" } }).catch(() => 0),
    prisma.affiliate.count({ where: { status: "ACTIVE" } }).catch(() => 0),
  ]);

  return { services, completed, affiliates };
});
