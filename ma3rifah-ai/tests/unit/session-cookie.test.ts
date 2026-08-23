import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * توقيع ختم الجلسة.
 *
 * الختم يصل من المتصفح، ومن يملك تحريره يملك تمديد جلسته إلى الأبد
 * بتغيير رقم فيه. فالمقصود هنا إثبات أن **تحرير الختم يُكشف** — لا أن
 * قراءته تعمل. ولذلك أكثر الاختبارات أدناه محاولاتُ تزوير.
 *
 * والوحدة تُعاد تحميلها في كل اختبار لأن مفتاح التوقيع يُخزَّن مؤقتًا،
 * وتغيير السرّ بلا إعادة تحميل يقرأ مفتاحًا قديمًا فيمرّ ما لا ينبغي.
 */

const SECRET = 'test-session-secret-value-long-enough';

/**
 * إعادة التحميل بـ`resetModules` لا بمعامل في المسار: الأخير يجعل
 * المُجمِّع يقرأ الامتداد من المعامل فيفشل التحميل أصلًا.
 */
async function loadModule() {
  vi.resetModules();
  return import('@/lib/auth/session-cookie');
}

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.SESSION_SECRET;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe('ختم الجلسة', () => {
  it('يُقرأ ما كُتب كما كُتب', async () => {
    const { encodeStamp, decodeStamp } = await loadModule();
    const original = { tier: 'ADMIN' as const, startedAt: 1_700_000_000_000, lastSeenAt: 1_700_000_060_000 };

    const encoded = await encodeStamp(original);
    expect(encoded).not.toBeNull();

    expect(await decodeStamp(encoded!)).toEqual(original);
  });

  it('تغيير تاريخ في الختم يُبطله', async () => {
    const { encodeStamp, decodeStamp } = await loadModule();
    const encoded = await encodeStamp({
      tier: 'ADMIN',
      startedAt: 1_700_000_000_000,
      lastSeenAt: 1_700_000_000_000,
    });

    // محاولة تمديد الجلسة بتقديم تاريخ البداية
    const parts = encoded!.split('.');
    parts[1] = String(Number(parts[1]) + 86_400_000);

    expect(await decodeStamp(parts.join('.'))).toBeNull();
  });

  it('ترقية الرتبة في الختم تُبطله', async () => {
    // لو مرّت، لَاستطاع مدير تخفيف سياسته بتغيير كلمة واحدة
    const { encodeStamp, decodeStamp } = await loadModule();
    const encoded = await encodeStamp({
      tier: 'ADMIN',
      startedAt: 1_700_000_000_000,
      lastSeenAt: 1_700_000_000_000,
    });

    expect(await decodeStamp(encoded!.replace('ADMIN', 'STANDARD'))).toBeNull();
  });

  it('ختم بسرّ آخر لا يُقبل', async () => {
    const first = await loadModule();
    const encoded = await first.encodeStamp({
      tier: 'STANDARD',
      startedAt: 1_700_000_000_000,
      lastSeenAt: 1_700_000_000_000,
    });

    process.env.SESSION_SECRET = 'a-completely-different-secret-value';
    const { decodeStamp } = await loadModule();

    expect(await decodeStamp(encoded!)).toBeNull();
  });

  it('القيم المشوّهة تُرفض بلا استثناء', async () => {
    const { decodeStamp } = await loadModule();
    for (const value of ['', 'x', 'a.b.c', 'a.b.c.d.e', 'ADMIN.1.2', 'ADMIN.1.2.zzz']) {
      expect(await decodeStamp(value)).toBeNull();
    }
    expect(await decodeStamp(undefined)).toBeNull();
  });
});

describe('غياب السرّ', () => {
  it('بلا سرّ لا يُوقَّع ختم ولا يُقبل', async () => {
    // الاتجاه الآمن: تعطّل ظاهر خيرٌ من حراسة صامتة لا تحرس
    delete process.env.SESSION_SECRET;
    const { encodeStamp, hasSessionSecret } = await loadModule();

    expect(hasSessionSecret()).toBe(false);
    expect(
      await encodeStamp({ tier: 'ADMIN', startedAt: 1, lastSeenAt: 1 }),
    ).toBeNull();
  });

  it('يُشتقّ من مفتاح الخدمة عند غياب السرّ الصريح', async () => {
    delete process.env.SESSION_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-that-is-long-enough';

    const { encodeStamp, decodeStamp, hasSessionSecret } = await loadModule();

    expect(hasSessionSecret()).toBe(true);
    const stamp = { tier: 'STANDARD' as const, startedAt: 1_700_000_000_000, lastSeenAt: 1_700_000_000_000 };
    const encoded = await encodeStamp(stamp);
    expect(await decodeStamp(encoded!)).toEqual(stamp);
  });

  it('سرّ قصير لا يُقبل', async () => {
    delete process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = 'short';
    const { hasSessionSecret } = await loadModule();
    expect(hasSessionSecret()).toBe(false);
  });
});

describe('خصائص الكوكي', () => {
  it('محجوب عن JavaScript ومقيَّد بالموقع', async () => {
    const { sessionCookieOptions } = await loadModule();
    const options = sessionCookieOptions(3600);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/');
    expect(options.maxAge).toBe(3600);
  });
});
