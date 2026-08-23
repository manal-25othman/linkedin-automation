import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROI_DEFAULTS,
  ROI_PLANS,
  computeRoi,
  normalizeInputs,
  selectPlan,
} from '../../src/lib/roi';

/**
 * حاسبة العائد.
 *
 * ما يُختبر هنا **صدق الرقم** لا صحّة الضرب. وحاسبة العائد أسهل ما
 * يُزيَّف في منتج: يكفي أن تُرفع نسبة الإجابة إلى ١٠٠٪ أو تُختار خطة
 * أرخص من اللازم فيتضاعف «العائد» بلا كذبة صريحة.
 *
 * فالاختبارات هنا حرّاس على التحفّظ نفسه.
 */

describe('حدود المدخلات', () => {
  it('القيم السالبة والصفرية تُردّ إلى الحدّ الأدنى', () => {
    const input = normalizeInputs({
      employees: -5,
      questionsPerWeek: -1,
      minutesPerQuestion: 0,
      hourlyCostSar: 0,
      answerRate: 0,
    });

    expect(input.employees).toBe(1);
    expect(input.questionsPerWeek).toBe(0);
    expect(input.minutesPerQuestion).toBe(1);
    expect(input.hourlyCostSar).toBe(10);
    expect(input.answerRate).toBe(0.1);
  });

  it('القيم الهائلة تُقصّ — فلا يُعرض عائد سخيف', () => {
    const input = normalizeInputs({ employees: 999_999, minutesPerQuestion: 5000 });
    expect(input.employees).toBe(5000);
    expect(input.minutesPerQuestion).toBe(120);
  });

  it('NaN لا يُنتج NaN في النتيجة', () => {
    const result = computeRoi({ employees: Number.NaN, hourlyCostSar: Number.NaN });
    expect(Number.isFinite(result.savedSar)).toBe(true);
  });

  it('نسبة الإجابة لا تتجاوز الواحد مهما أُدخل', () => {
    expect(normalizeInputs({ answerRate: 5 }).answerRate).toBe(1);
  });
});

describe('التحفّظ — وهو ما يجعل الرقم قابلًا للتصديق', () => {
  it('نسبة الإجابة الابتدائية أقلّ من ١٠٠٪', () => {
    // الافتراض الذي تُخفيه أكثر الحاسبات. رفعُه إلى ١ يضاعف كل النتائج
    expect(ROI_DEFAULTS.answerRate).toBeLessThanOrEqual(0.7);
    expect(ROI_DEFAULTS.answerRate).toBeGreaterThan(0);
  });

  it('لا يُحسب إلا ما تجيب عنه المنصّة — لا كل الأسئلة', () => {
    const result = computeRoi({ ...ROI_DEFAULTS, answerRate: 0.5 });
    expect(result.answeredPerMonth).toBeLessThan(result.questionsPerMonth);
    expect(result.answeredPerMonth).toBeCloseTo(result.questionsPerMonth * 0.5, -1);
  });
});

describe('اختيار الخطة', () => {
  it('يراعي الموظفين والأسئلة معًا لا أحدهما', () => {
    // عشرة موظفين تسعهم Starter، لكن ٥٬٠٠٠ سؤال لا تسعها حصتها
    expect(selectPlan(10, 5000).code).toBe('BUSINESS');
    // وسبعون موظفًا لا تسعهم Growth ولو قلّت أسئلتهم
    expect(selectPlan(70, 100).code).toBe('BUSINESS');
  });

  it('يختار أصغر خطة كافية لا أكبر', () => {
    expect(selectPlan(8, 500).code).toBe('STARTER');
    expect(selectPlan(25, 1500).code).toBe('GROWTH');
  });

  it('ما يتجاوز أكبر خطة يقع في Enterprise', () => {
    expect(selectPlan(500, 50_000).code).toBe('ENTERPRISE');
  });

  it('الخطة التفاوضية لا يُخترع لها سعر ولا عائد', () => {
    const result = computeRoi({ employees: 2000, questionsPerWeek: 5 });
    expect(result.plan.code).toBe('ENTERPRISE');
    expect(result.planCostSar).toBeNull();
    expect(result.netSar).toBeNull();
    expect(result.ratio).toBeNull();
    expect(result.paybackDays).toBeNull();
  });
});

describe('الحساب', () => {
  it('الحالة الابتدائية تُنتج أرقامًا متّسقة', () => {
    const result = computeRoi(ROI_DEFAULTS);

    // ٢٥ موظفًا × ٣ أسئلة أسبوعيًا × ٤٫٣٣ ≈ ٣٢٥ سؤالًا شهريًا
    expect(result.questionsPerMonth).toBeGreaterThan(310);
    expect(result.questionsPerMonth).toBeLessThan(340);

    expect(result.plan.code).toBe('GROWTH');
    // الرقم المعروض يجب أن يُجمع: الساعات × سعر الساعة = الريال المعروض
    expect(result.savedSar).toBe(result.hoursSavedPerMonth * ROI_DEFAULTS.hourlyCostSar);
  });

  it('الحالة الابتدائية موجبة — لكن بهامش معقول لا مُبهر', () => {
    const result = computeRoi(ROI_DEFAULTS);
    expect(result.netSar).toBeGreaterThan(0);
    // عائدٌ يتجاوز أربعة أضعاف من حالة ابتدائية يُقرأ مبالغة لا وعدًا
    expect(result.ratio).toBeLessThan(4);
  });

  /**
   * عتبة التعادل — حدّ السوق لا حدّ الحاسبة.
   *
   * دون ~٢٫٥ سؤال متكرّر لكل موظف أسبوعيًا يصير العائد سالبًا. والاختبار
   * يثبّت ذلك كي لا يُرفع سعرٌ أو تُخفَّض حصّةٌ فتنقلب الحاسبة إلى وعد لا
   * يصحّ لأكثر من نصف من يجرّبها دون أن ينتبه أحد.
   */
  it('العتبة معلومة ومثبَّتة: ما دون ~٢٫٥ سؤال أسبوعيًا لا يُجدي', () => {
    const below = computeRoi({ ...ROI_DEFAULTS, questionsPerWeek: 1.5 });
    const above = computeRoi({ ...ROI_DEFAULTS, questionsPerWeek: 3 });

    expect(below.netSar).toBeLessThan(0);
    expect(above.netSar).toBeGreaterThan(0);
  });

  it('الوفر الصافي يساوي الوفر ناقص الاشتراك', () => {
    const result = computeRoi(ROI_DEFAULTS);
    expect(result.netSar).toBe(result.savedSar - (result.planCostSar ?? 0));
  });

  it('العائد قد يكون سالبًا — ولا يُخفى', () => {
    // شركة صغيرة بأسئلة نادرة: الاشتراك أغلى من الوفر، وهذا جوابٌ صادق
    const result = computeRoi({
      employees: 5,
      questionsPerWeek: 0.5,
      minutesPerQuestion: 5,
      hourlyCostSar: 30,
      answerRate: 0.5,
    });
    expect(result.netSar).toBeLessThan(0);
  });

  it('مدة الاسترداد لا تتجاوز الشهر ولا تكون صفرًا', () => {
    const result = computeRoi(ROI_DEFAULTS);
    expect(result.paybackDays).toBeGreaterThan(0);
    expect(result.paybackDays).toBeLessThanOrEqual(30);
  });
});

/**
 * حارس التطابق مع الترحيلة.
 *
 * الخطط مكرّرة في `roi.ts` كي لا تُقرأ القاعدة على كل زيارة تسويقية.
 * والتكرار يتعفّن: تُغيَّر الأسعار في الترحيلة وتبقى الحاسبة تعرض
 * القديم — فتحسب الشركة عائدها على سعرٍ لا تدفعه.
 */
describe('تطابق الخطط مع الترحيلة 0025', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/0025_plan_repricing.sql'),
    'utf8',
  );

  it('كل سعر في الحاسبة موجود في الترحيلة', () => {
    for (const plan of ROI_PLANS) {
      if (plan.monthlySar === null) continue;
      expect(migration, `سعر ${plan.name}`).toContain(`${plan.monthlySar}.00`);
    }
  });

  it('كل حصّة أسئلة في الحاسبة موجودة في الترحيلة', () => {
    for (const plan of ROI_PLANS) {
      if (!Number.isFinite(plan.maxQuestions)) continue;
      expect(migration, `حصّة ${plan.name}`).toMatch(
        new RegExp(`\\b${plan.maxQuestions}\\b`),
      );
    }
  });

  it('كل حدّ مستخدمين في الحاسبة موجود في الترحيلة', () => {
    for (const plan of ROI_PLANS) {
      if (!Number.isFinite(plan.maxUsers)) continue;
      expect(migration, `مستخدمو ${plan.name}`).toMatch(new RegExp(`\\b${plan.maxUsers}\\b`));
    }
  });
});
