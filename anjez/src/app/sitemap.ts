import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/payments";

/** يُعاد بناؤها كل ساعة: كتالوج الخدمات يتغيّر بالإضافة لا بالدقيقة. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/services`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/affiliate`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/track`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // فشل القاعدة لا يُسقط الخريطة كلها: الصفحات الثابتة تبقى مفهرسة.
  const services = await prisma.service
    .findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    })
    .catch(() => []);

  const categories = await prisma.category
    .findMany({ where: { isActive: true }, select: { slug: true } })
    .catch(() => []);

  return [
    ...staticPages,
    ...services.map((service) => ({
      url: `${siteUrl}/services/${service.slug}`,
      lastModified: service.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...categories.map((category) => ({
      url: `${siteUrl}/services?category=${category.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
