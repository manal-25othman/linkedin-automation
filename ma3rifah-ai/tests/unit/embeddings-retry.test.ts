import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * إعادة المحاولة عند تجاوز حدّ مزوّد التضمين.
 *
 * حسابٌ جديد لدى المزوّد يبدأ بحدّ منخفض جدًّا — ثلاثة طلبات في الدقيقة
 * قبل إضافة وسيلة الدفع. ومستندٌ من عشرين صفحة يُقطَّع دفعات، فيصطدم
 * بالحدّ من الدفعة الثانية **ويسقط المستند كلّه بلا محاولة واحدة**.
 *
 * والمستخدم حينها يرفع الملف مرارًا، فيستهلك الحدّ نفسه ويفشل ثانيةً.
 */

const SOURCE = readFileSync(join(process.cwd(), 'src/lib/rag/embeddings.ts'), 'utf8');
const INGEST = readFileSync(join(process.cwd(), 'src/lib/rag/ingest.ts'), 'utf8');

afterEach(() => vi.restoreAllMocks());

describe('سياسة إعادة المحاولة', () => {
  it('429 و5xx يُعادان — و4xx غيرهما لا', () => {
    expect(SOURCE).toContain('status === 429');
    expect(SOURCE).toContain('status >= 500');
  });

  it('كلا المزوّدين يمرّ بإعادة المحاولة — لا أحدهما', () => {
    // النداء المباشر يلتفّ على السياسة كلها
    const direct = SOURCE.match(/await fetchWithTimeout\(/g) ?? [];
    expect(direct.length, 'نداء مباشر يلتفّ على إعادة المحاولة').toBe(1); // داخل fetchWithRetry وحده

    const retried = SOURCE.match(/await fetchWithRetry\(/g) ?? [];
    expect(retried.length).toBe(2);
  });

  it('`Retry-After` يُحترم — فهو أدقّ من أي تخمين', () => {
    expect(SOURCE.toLowerCase()).toContain('retry-after');
  });

  it('الانتظار مقصوص — البيئة لها سقف زمني', () => {
    // انتظارٌ أطول من السقف يُسقط الطلب كلّه بدل أن ينقذه
    expect(SOURCE).toContain('MAX_BACKOFF_MS');
    const cap = SOURCE.match(/MAX_BACKOFF_MS = ([\d_]+)/);
    expect(cap).not.toBeNull();
    expect(Number(cap![1].replace(/_/g, ''))).toBeLessThanOrEqual(30_000);
  });

  it('عدد المحاولات محدود — لا حلقة لا تنتهي', () => {
    const attempts = SOURCE.match(/MAX_ATTEMPTS = (\d+)/);
    expect(attempts).not.toBeNull();
    expect(Number(attempts![1])).toBeGreaterThanOrEqual(2);
    expect(Number(attempts![1])).toBeLessThanOrEqual(5);
  });

  it('رسالة 429 عربية وتقول ما يُفعَل', () => {
    expect(SOURCE).toContain('وسيلة دفع');
    expect(SOURCE).toContain('أعد المحاولة');
  });
});

describe('لا تفاصيل تقنية في رسالة المستند الفاشل', () => {
  it('الرسالة المعروضة لا تضمّ التفصيل', () => {
    // كان يظهر: Voyage 429: {"detail":"You have not yet added your payment…»
    // إنجليزيّ في واجهة عربية، ويكشف اسم المزوّد لكل مستخدم في كل شركة
    expect(INGEST).not.toContain('تفصيل تقني:');
  });

  it('التفصيل يبقى في السجلّ منقَّحًا', () => {
    // يُشخَّص العطل ولا يُعرض — وهما شيئان مختلفان
    expect(INGEST).toMatch(/sanitizeTechnicalDetail\(appError\.detail/);
  });
});

/**
 * طبقة واحدة لا طبقتان.
 *
 * كانت `embedTexts` تلفّ نداء المزوّد بحلقة إعادة محاولة، ثم أُضيفت
 * حلقة ثانية داخل `fetchWithRetry`. فتضاعفتا: تسعة طلبات وانتظارٌ
 * مجموعه اثنتان وستون ثانية.
 *
 * وكلا الرقمين ضارّ: تسعة طلبات على حدٍّ ثلاثة في الدقيقة **تُعمّق
 * التجاوز**، واثنتان وستون ثانية **تتجاوز سقف الدالّة** فيسقط الطلب
 * قبل أن تصل المحاولة الأخيرة.
 *
 * وطبقتان متداخلتان خطأ يتكرّر لأن كلًّا منهما تبدو صحيحة وحدها.
 */
describe('لا تداخل بين طبقتَي إعادة المحاولة', () => {
  it('embedTexts لا تحوي حلقة إعادة محاولة خاصّة بها', () => {
    const body = SOURCE.slice(SOURCE.indexOf('export async function embedTexts'));
    expect(body, 'حلقة محاولات ثانية تضاعف الطلبات').not.toMatch(/for \(let attempt/);
  });

  it('توجد حلقة واحدة فقط في الملف كلّه', () => {
    const loops = SOURCE.match(/for \(let attempt = 0/g) ?? [];
    expect(loops.length).toBe(1);
  });

  it('أسوأ انتظار يبقى دون سقف الدالّة', () => {
    // 5 ثوانٍ ثم 15 = 20 ثانية لثلاث محاولات
    const cap = Number(SOURCE.match(/MAX_BACKOFF_MS = ([\d_]+)/)![1].replace(/_/g, ''));
    const attempts = Number(SOURCE.match(/MAX_ATTEMPTS = (\d+)/)![1]);
    expect((attempts - 1) * cap).toBeLessThan(60_000);
  });

  it('انقطاع الشبكة يُعاد أيضًا — لا الردود وحدها', () => {
    // الانقطاع يُرمى ولا يُرَدّ، فلولا معالجته هنا لسقط بلا محاولة
    expect(SOURCE).toContain('networkError');
  });
});
