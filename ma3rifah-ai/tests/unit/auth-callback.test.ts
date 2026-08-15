import { describe, expect, it } from 'vitest';

/**
 * حارس وجهة إعادة التوجيه بعد المصادقة.
 *
 * القاعدة منقولة حرفيًا من مسار auth/callback. وجهة غير مقيّدة على مسار
 * مصادقة ثغرة تصيّد كلاسيكية: رابط من نطاقنا — يثق به المستخدم ويثق به
 * فلتر البريد — ينقله إلى نسخة مزوّرة من صفحة الدخول.
 *
 * والخطر لا يقتصر على `https://evil.com`: القيمة `//evil.com` عنوان
 * بلا مخطّط، يقرؤه المتصفح نطاقًا خارجيًا وتقرؤه فحوصات ساذجة مسارًا
 * داخليًا لأنها تبدأ بشرطة مائلة.
 */
function safeNext(requested: string | null): string {
  const next = requested ?? '/dashboard';
  return /^\/[^/]/.test(next) ? next : '/dashboard';
}

describe('وجهة ما بعد المصادقة', () => {
  it('يقبل المسارات الداخلية', () => {
    expect(safeNext('/reset-password')).toBe('/reset-password');
    expect(safeNext('/dashboard')).toBe('/dashboard');
    expect(safeNext('/settings/profile')).toBe('/settings/profile');
  });

  it('يرفض العناوين الخارجية الصريحة', () => {
    for (const evil of [
      'https://evil.com',
      'http://evil.com/login',
      'ftp://evil.com',
    ]) {
      expect(safeNext(evil)).toBe('/dashboard');
    }
  });

  it('يرفض العنوان بلا مخطّط — أخطر الصيغ وأخفاها', () => {
    // المتصفح يقرأ //evil.com نطاقًا خارجيًا، والفحص الساذج يقرؤه مسارًا
    expect(safeNext('//evil.com')).toBe('/dashboard');
    expect(safeNext('//evil.com/login')).toBe('/dashboard');
    expect(safeNext('///evil.com')).toBe('/dashboard');
  });

  it('يرفض ما لا يبدأ بشرطة مائلة', () => {
    expect(safeNext('evil.com')).toBe('/dashboard');
    expect(safeNext('dashboard')).toBe('/dashboard');
  });

  it('يسقط إلى الوجهة الافتراضية عند الغياب', () => {
    expect(safeNext(null)).toBe('/dashboard');
    expect(safeNext('')).toBe('/dashboard');
  });
});
