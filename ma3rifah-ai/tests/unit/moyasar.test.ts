import { afterEach, describe, expect, it, vi } from 'vitest';

import { toHalalas, fromHalalas, readWebhookEnvelope } from '@/lib/billing/moyasar';

/**
 * تحويل المبالغ والتقاط حمولة الـwebhook.
 *
 * المال آخر موضع يُحتمل فيه خطأ التقريب، والـwebhook أول باب يُطرق.
 */

describe('تحويل المبالغ إلى هللات', () => {
  it('يحوّل الريال إلى هللة صحيحةً', () => {
    expect(toHalalas(499)).toBe(49900);
    expect(toHalalas(999)).toBe(99900);
    expect(toHalalas(0.5)).toBe(50);
  });

  it('لا يترك كسرًا عشريًا مهما كان المدخل', () => {
    // 19.99 * 100 = 1998.9999999999998 في حساب الفاصلة العائمة.
    // تمريرها كما هي إلى بوابة تتوقع عددًا صحيحًا يرفض الطلب أو يقتطع
    // الكسر — وأيًّا كان، فالمبلغ المحفوظ عندنا لن يطابق المدفوع، وفحص
    // المطابقة سيرفض دفعةً صحيحة.
    expect(Number.isInteger(toHalalas(19.99))).toBe(true);
    expect(toHalalas(19.99)).toBe(1999);
    expect(toHalalas(0.1 + 0.2)).toBe(30);
  });

  it('يعود بالمبلغ كما كان', () => {
    expect(fromHalalas(toHalalas(499))).toBe(499);
    expect(fromHalalas(99900)).toBe(999);
  });
});

describe('قراءة حمولة الـwebhook', () => {
  it('يقرأ المعرّف والرمز من جذر الحمولة', () => {
    expect(
      readWebhookEnvelope({ id: 'pay_123', secret_token: 'shhh' }),
    ).toEqual({ paymentId: 'pay_123', secret: 'shhh' });
  });

  it('يقرأهما من داخل data — صيغة أخرى للحمولة نفسها', () => {
    expect(
      readWebhookEnvelope({ type: 'payment_paid', data: { id: 'pay_456', secret_token: 'shhh' } }),
    ).toEqual({ paymentId: 'pay_456', secret: 'shhh' });
  });

  it('يقبل الأسماء البديلة للرمز', () => {
    expect(readWebhookEnvelope({ id: 'p', shared_secret: 's' }).secret).toBe('s');
    expect(readWebhookEnvelope({ id: 'p', secret: 's' }).secret).toBe('s');
  });

  it('يردّ فراغًا على حمولة لا تصلح — ولا يرمي', () => {
    // نداء عابث قد يرسل أي شيء؛ الانهيار هنا يعني ٥٠٠ فإعادة إرسال لا تنتهي
    for (const payload of [null, undefined, 'نص', 42, [], {}]) {
      expect(readWebhookEnvelope(payload)).toEqual({ paymentId: null, secret: null });
    }
  });

  it('يتجاهل القيم الفارغة وغير النصية', () => {
    expect(readWebhookEnvelope({ id: '', data: { id: 'pay_9' } }).paymentId).toBe('pay_9');
    expect(readWebhookEnvelope({ id: 12345 }).paymentId).toBeNull();
  });
});

describe('التحقق من رمز الـwebhook', () => {
  const ORIGINAL = process.env.MOYASAR_WEBHOOK_SECRET;

  afterEach(() => {
    process.env.MOYASAR_WEBHOOK_SECRET = ORIGINAL;
    vi.resetModules();
  });

  async function loadVerifier(secret: string | undefined) {
    if (secret === undefined) delete process.env.MOYASAR_WEBHOOK_SECRET;
    else process.env.MOYASAR_WEBHOOK_SECRET = secret;
    vi.resetModules();
    const module = await import('@/lib/billing/moyasar');
    return module.verifyWebhookSecret;
  }

  it('يقبل الرمز المطابق', async () => {
    const verify = await loadVerifier('correct-secret');
    expect(verify('correct-secret')).toBe(true);
  });

  it('يرفض الرمز المخالف والفارغ', async () => {
    const verify = await loadVerifier('correct-secret');
    expect(verify('wrong-secret')).toBe(false);
    expect(verify('')).toBe(false);
    expect(verify(null)).toBe(false);
    expect(verify(undefined)).toBe(false);
  });

  it('يرفض ما اختلف طوله بلا أن يرمي', async () => {
    // timingSafeEqual يرمي على اختلاف الطول، والرمي هنا يصير ٥٠٠
    const verify = await loadVerifier('correct-secret');
    expect(() => verify('short')).not.toThrow();
    expect(verify('short')).toBe(false);
    expect(verify('correct-secret-with-extra-tail')).toBe(false);
  });

  it('يرفض الجميع حين لا يكون الرمز مضبوطًا عندنا', async () => {
    // ‏الاتجاه الآمن: غياب الإعداد يقفل الباب ولا يفتحه. لو قُبل الجميع
    // لصار نشرٌ ناقص الإعداد بابًا يطرقه أي أحد بـ«تم الدفع».
    const verify = await loadVerifier(undefined);
    expect(verify('anything')).toBe(false);
    expect(verify('')).toBe(false);
  });
});
