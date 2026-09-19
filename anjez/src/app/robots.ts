import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/payments";

/**
 * اللوحات ومسارات الإحالة وواجهات API لا قيمة لفهرستها، وبعضها يكشف أرقام
 * طلبات في نتائج البحث. الباقي مفتوح للزحف.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/partner", "/api", "/r/", "/orders/", "/checkout/", "/order/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
