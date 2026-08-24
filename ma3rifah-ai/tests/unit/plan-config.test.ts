import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_PLAN_CODE,
  FALLBACK_PLANS,
  TRIAL_PERIOD_DAYS,
} from '../../src/lib/config/plans';

/**
 * تطابق إعدادات الخطط مع الترحيلات.
 *
 * `FALLBACK_PLANS` نسخة تُعرض حين تتعذّر القاعدة. وقد كانت عالقة على
 * أسعار ما قبل إعادة التسعير (٤٩٩ و٩٩٩) وحدودها، بلا خطة Growth —
 * أي أن انقطاعًا لحظةَ بناءٍ كان يعرض على الزائر **الأسعار التي تخسر**.
 *
 * والنسخة الاحتياطية أخطر ما يتعفّن: لا تُرى في التشغيل العادي أبدًا،
 * فلا يكتشف أحد قِدَمها إلا في اللحظة التي تُعرض فيها — وهي أسوأ لحظة.
 */
const migration = (name: string) =>
  readFileSync(join(process.cwd(), 'supabase/migrations', name), 'utf8');

describe('الخطط الاحتياطية تطابق الترحيلة 0025', () => {
  const sql = migration('0025_plan_repricing.sql');
  const paid = FALLBACK_PLANS.filter((plan) => plan.price_amount !== null && plan.price_amount > 0);

  it('توجد خطط مدفوعة أصلًا — وإلا فالحارس يحرس فراغًا', () => {
    expect(paid.length).toBeGreaterThanOrEqual(3);
  });

  it('كل سعر موجود في الترحيلة', () => {
    for (const plan of paid) {
      expect(sql, `سعر ${plan.code}`).toContain(`${plan.price_amount}.00`);
    }
  });

  it('كل حصّة أسئلة موجودة في الترحيلة', () => {
    for (const plan of paid) {
      expect(sql, `حصّة ${plan.code}`).toMatch(
        new RegExp(`\\b${plan.max_questions_monthly}\\b`),
      );
    }
  });

  it('خطة Growth موجودة — أُضيفت في 0025 وكانت غائبة هنا', () => {
    expect(FALLBACK_PLANS.map((plan) => plan.code)).toContain('GROWTH');
  });
});

describe('التجربة', () => {
  const sql = migration('0029_trial_plan.sql');

  it('الشركة الجديدة تُسنَد إلى TRIAL لا إلى خطة مدفوعة', () => {
    // كانت STARTER: خمسون مستندًا وستمئة سؤال لمن لم يدفع شيئًا
    expect(DEFAULT_PLAN_CODE).toBe('TRIAL');
  });

  it('المدة سبعة أيام', () => {
    expect(TRIAL_PERIOD_DAYS).toBe(7);
  });

  it('حدود التجربة في الترحيلة: ٣ مستخدمين و١٠ مستندات و٥٠ سؤالًا', () => {
    const body = sql.slice(sql.indexOf("'TRIAL'"), sql.indexOf('on conflict'));
    expect(body).toMatch(/\b3\b/);
    expect(body).toMatch(/\b10\b/);
    expect(body).toMatch(/\b50\b/);
  });

  it('خطة التجربة لا تُعرض في صفحة الأسعار', () => {
    // هي حالةٌ لا خطةٌ تُشترى؛ وعرضها يوحي بأن ثمّة ما يُختار
    expect(sql).toMatch(/false,\s*--\s*لا تظهر/);
  });

  it('التجربة أضيق من أرخص خطة مدفوعة في كل حدّ', () => {
    // التجربة التي تساوي الخطة المدفوعة لا تبيع شيئًا
    const starter = FALLBACK_PLANS.find((plan) => plan.code === 'STARTER');
    expect(starter).toBeDefined();
    expect(50).toBeLessThan(starter!.max_questions_monthly!);
    expect(10).toBeLessThan(starter!.max_documents!);
    expect(3).toBeLessThan(starter!.max_users!);
  });
});
