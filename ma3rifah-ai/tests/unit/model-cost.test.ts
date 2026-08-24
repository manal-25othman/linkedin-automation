import { describe, expect, it } from 'vitest';
import { estimateCostUsd } from '../../src/lib/ai/claude';

/**
 * تسعير الاستدعاء.
 *
 * كان العطب أن `input_tokens` **لا يشمل الرموز المخزَّنة مؤقتًا**: يفصلها
 * المزوّد في حقلين مستقلّين، فحسابُ الدخل وحده يُسقط تكلفة التخزين
 * كلّها. والخطأ في اتجاه واحد — **التكلفة تظهر أقلّ مما هي** — فيظهر
 * الربح في اللوحة المالية أعلى مما هو.
 *
 * وهذا أسوأ اتجاهي الخطأ: الرقم المتفائل لا يدفع أحدًا إلى مراجعته.
 */

describe('تسعير النماذج', () => {
  it('Sonnet 5: ٣$ دخلًا و١٥$ خرجًا لكل مليون رمز', () => {
    // مليون دخل + مليون خرج = ١٨$
    expect(estimateCostUsd('claude-sonnet-5', 1_000_000, 1_000_000)).toBeCloseTo(18, 5);
  });

  it('Haiku 4.5: ١$ دخلًا و٥$ خرجًا', () => {
    expect(estimateCostUsd('claude-haiku-4-5', 1_000_000, 1_000_000)).toBeCloseTo(6, 5);
  });

  it('Opus 5: ٥$ دخلًا و٢٥$ خرجًا — الأغلى', () => {
    expect(estimateCostUsd('claude-opus-5', 1_000_000, 1_000_000)).toBeCloseTo(30, 5);
  });

  it('نموذج مجهول يُسعَّر بأغلى تعرفة لا بأرخصها', () => {
    // التقدير المتحفّظ يمنع مفاجأة في الفاتورة عند إضافة نموذج جديد
    const unknown = estimateCostUsd('نموذج-لم-يُسجَّل', 1_000_000, 1_000_000);
    expect(unknown).toBeGreaterThanOrEqual(
      estimateCostUsd('claude-sonnet-5', 1_000_000, 1_000_000),
    );
  });
});

describe('التخزين المؤقت يدخل الحساب', () => {
  it('القراءة من المخزَّن بعُشر سعر الدخل', () => {
    const cached = estimateCostUsd('claude-sonnet-5', 0, 0, 1_000_000, 0);
    expect(cached).toBeCloseTo(0.3, 5); // ٣$ × ٠٫١
  });

  it('الكتابة إلى المخزَّن بضعفٍ وربع', () => {
    const written = estimateCostUsd('claude-sonnet-5', 0, 0, 0, 1_000_000);
    expect(written).toBeCloseTo(3.75, 5); // ٣$ × ١٫٢٥
  });

  it('رموز مخزَّنة بلا تكلفة = العطب القديم', () => {
    // لو أُهملت لكانت النتيجة صفرًا — وهذا ما كان يحدث
    expect(estimateCostUsd('claude-sonnet-5', 0, 0, 500_000, 100_000)).toBeGreaterThan(0);
  });

  it('التخزين المؤقت يوفّر فعلًا — وإلا فلا معنى له', () => {
    const withoutCache = estimateCostUsd('claude-sonnet-5', 1_000_000, 0);
    const withCache = estimateCostUsd('claude-sonnet-5', 0, 0, 1_000_000, 0);
    expect(withCache).toBeLessThan(withoutCache * 0.2);
  });

  it('استدعاء واقعي: موجّه مخزَّن + سؤال + جواب', () => {
    // ٤٬٠٠٠ رمز موجّه مقروء من المخزَّن · ٢٬٠٠٠ دخل جديد · ٨٠٠ خرج
    const cost = estimateCostUsd('claude-sonnet-5', 2_000, 800, 4_000, 0);
    const ignoringCache = estimateCostUsd('claude-sonnet-5', 2_000, 800);

    expect(cost).toBeGreaterThan(ignoringCache);
    // والفارق ليس مهملًا: تسعة بالمئة على هذا المثال
    expect(cost / ignoringCache).toBeGreaterThan(1.05);
  });
});
