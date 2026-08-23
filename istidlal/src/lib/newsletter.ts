import "server-only";

/**
 * هل الاشتراك بالبريد مفعّل فعلًا؟ تُقرأ على الخادم وتُمرَّر إلى الواجهة،
 * فلا يُعرض نموذج لا يؤدّي إلى شيء.
 */
export function isNewsletterEnabled(): boolean {
  return Boolean(process.env.NEWSLETTER_ENDPOINT);
}
