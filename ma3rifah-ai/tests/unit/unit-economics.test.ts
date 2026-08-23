import { describe, expect, it } from 'vitest';
import { estimateCostUsd } from '../../src/lib/ai/claude';

/**
 * اقتصاديات الوحدة — حارسٌ على نموذج العمل لا على الشيفرة.
 *
 * كانت المنصة تخسر على كل عميل: النموذج الافتراضي `claude-opus-5`
 * بسقف خرج 8000، وحصةُ Starter خمسة آلاف سؤال بـ499 ريالًا. أي أن
 * **العميل الأكثر استعمالًا هو الأكثر خسارةً** — وهو انقلابٌ في نموذج
 * العمل لا مسألة تحسين.
 *
 * وسبب بقائه خفيًا أن لا شيء في المنصة يقيسه: الشيفرة تعمل،
 * والاختبارات تمرّ، والفاتورة تصل بعد شهر. فهذا الملف يجعله رقمًا
 * يفشل البناءُ إن انقلب — تمامًا كاختبار أمنيّ.
 *
 * والأرقام هنا تقديرية بطبيعتها. والحارس ليس على دقّتها بل على
 * **اتجاهها**: أن يبقى الهامش موجبًا بفارق معتبر عند الاستهلاك الكامل.
 */

const SAR_PER_USD = 3.75;

/** بنية الطلب كما هي في `retrieval.ts` و`prompts.ts` */
const SYSTEM_TOKENS = 1500;
const CHUNKS = 6; // max_context_chunks الافتراضي
const TOKENS_PER_CHUNK = 400;
const HISTORY_TOKENS = 1000;

/** الموجّه مخزَّن مؤقتًا (cache_control) فقراءته عُشر سعر الدخل */
const CACHE_READ_RATIO = 0.1;

function costPerQuestion(model: string, outputTokens: number): number {
  const cachedSystem = estimateCostUsd(model, SYSTEM_TOKENS, 0) * CACHE_READ_RATIO;
  const freshInput = estimateCostUsd(model, CHUNKS * TOKENS_PER_CHUNK + HISTORY_TOKENS, 0);
  const output = estimateCostUsd(model, 0, outputTokens);
  return cachedSystem + freshInput + output;
}

/** الخطط المعتمدة — السعر بالريال والحصة الشهرية */
const PLANS = [
  { name: 'Starter', sar: 899, questions: 600 },
  { name: 'Growth', sar: 2499, questions: 2000 },
  { name: 'Business', sar: 5999, questions: 6000 },
];

/** خرج واقعي مع جهد `low` — والحدّ الأعلى للأمان */
const TYPICAL_OUTPUT = 1200;
const WORST_OUTPUT = 3000; // سقف `ANTHROPIC_MAX_OUTPUT_TOKENS`

describe('تكلفة السؤال', () => {
  it('sonnet أرخص من opus بفارق معتبر', () => {
    const opus = costPerQuestion('claude-opus-5', TYPICAL_OUTPUT);
    const sonnet = costPerQuestion('claude-sonnet-5', TYPICAL_OUTPUT);
    // النسبة بالضبط 0.6 (3/5 دخلًا و15/25 خرجًا)، فالعتبة تحتها بهامش
    expect(sonnet).toBeLessThanOrEqual(opus * 0.65);
  });

  it('haiku أرخص من sonnet بفارق معتبر', () => {
    const sonnet = costPerQuestion('claude-sonnet-5', TYPICAL_OUTPUT);
    const haiku = costPerQuestion('claude-haiku-4-5', TYPICAL_OUTPUT);
    expect(haiku).toBeLessThanOrEqual(sonnet * 0.4);
  });

  it('السؤال الواحد على النموذج الافتراضي تحت خمسة سنتات', () => {
    expect(costPerQuestion('claude-sonnet-5', TYPICAL_OUTPUT)).toBeLessThan(0.05);
  });
});

describe('هامش الخطط عند الاستهلاك الكامل', () => {
  for (const plan of PLANS) {
    it(`${plan.name} تربح ولو استُهلكت كاملة`, () => {
      const revenue = plan.sar / SAR_PER_USD;
      const cost = plan.questions * costPerQuestion('claude-sonnet-5', TYPICAL_OUTPUT);
      const margin = (revenue - cost) / revenue;

      expect(margin, `${plan.name}: هامش ${(margin * 100).toFixed(0)}%`).toBeGreaterThan(
        0.7,
      );
    });

    it(`${plan.name} تربح حتى لو بلغ كل سؤال سقف الخرج`, () => {
      // أسوأ حالة ممكنة: كل إجابة تستهلك السقف كاملًا
      const revenue = plan.sar / SAR_PER_USD;
      const cost = plan.questions * costPerQuestion('claude-sonnet-5', WORST_OUTPUT);
      const margin = (revenue - cost) / revenue;

      expect(margin, `${plan.name} في أسوأ حالة: ${(margin * 100).toFixed(0)}%`).toBeGreaterThan(
        0.4,
      );
    });
  }

  it('العودة إلى opus بالحصص الحالية تقلب الهامش — ضبط سلبي', () => {
    // هذا ما كان عليه الحال، وهو ما يمنع هذا الملف تكرارَه صامتًا.
    // والحصة القديمة كانت 5000 سؤال بـ499 ريالًا.
    const revenue = 499 / SAR_PER_USD;
    const cost = 5000 * costPerQuestion('claude-opus-5', 2000);
    expect(cost).toBeGreaterThan(revenue);
  });
});
