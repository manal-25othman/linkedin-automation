import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ma3rifah.ai';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // مساحات العمل الخاصة بالعملاء لا تُفهرس
        disallow: [
          '/dashboard',
          '/assistant',
          '/documents',
          '/knowledge-base',
          '/knowledge-gaps',
          '/conversations',
          '/analytics',
          '/users',
          '/departments',
          '/settings',
          '/admin',
          '/login',
          '/register',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
