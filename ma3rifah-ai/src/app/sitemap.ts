import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ma3rifah.ai';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const routes: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }[] = [
    { path: '', priority: 1, changeFrequency: 'weekly' },
    { path: '/about', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/features', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/how-it-works', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/pricing', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/security', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/faq', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
  ];

  return routes.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
