import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // أرشيف الوسوم والبحث الداخلي: زحف بلا فهرسة.
        disallow: ["/search", "/tags/", "/admin", "/api/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
