import type { NextConfig } from "next";

/** ترويسات أمنية تُطبَّق على كل استجابة. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    // يُفعَّل خلف HTTPS فقط؛ لا أثر له محليًّا.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  async rewrites() {
    // لوحة المحرّر ملف ثابت في public؛ هذا يجعلها تُفتح من /admin مباشرةً.
    return [{ source: "/admin", destination: "/admin/index.html" }];
  },

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // نتائج البحث الداخلي بلا قيمة للزحف.
        source: "/search",
        headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
      },
      {
        // لوحة المحرّر وواجهات الاستيثاق: لا فهرسة ولا تخزين مؤقت.
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
