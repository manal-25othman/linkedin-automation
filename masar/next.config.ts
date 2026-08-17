import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /*
    هذه الحزم تُحمَّل وقت التشغيل على الخادم ولا تُحزَّم مع الكود: pdfjs
    وmammoth تقرآن ملفات، وdocx تكتبها. حزمها يكسر مسارات العُمّال (workers)
    الداخلية في pdfjs تحديدًا.
  */
  serverExternalPackages: ['pdfjs-dist', 'mammoth', 'docx'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
