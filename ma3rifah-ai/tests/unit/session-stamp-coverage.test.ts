import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SESSION_END_REASONS } from '../../src/lib/auth/session-policy';

/**
 * حارس: كل مسار يُنشئ جلسة يجب أن يختمها.
 *
 * الـmiddleware ينهي أي جلسة بلا ختم صالح. فمسارُ دخولٍ نُسي ختمه يعني
 * مستخدمًا يدخل بنجاح ثم يُطرد عند أول طلب — ورسالةً تقول «انتهت جلستك»
 * بعد ثانية من الدخول. عطلٌ محيّر، وسببه سطر واحد لم يُكتب.
 *
 * والفحص نصّي لأن العلاقة نصّية: لا مترجم يعرف أن `signInWithPassword`
 * تستوجب `stampSession` بعدها. وهو خشن عمدًا — يمسك النسيان لا يثبت
 * الصحة — ونسيانُ الاستدعاء هو ما يقع فعلًا.
 */

const SESSION_CREATORS = [
  {
    file: 'src/app/(auth)/actions.ts',
    what: 'تسجيل الدخول والتسجيل الجديد',
    creates: ['signInWithPassword', 'signUp'],
    // مساران يُنشئان جلسة في هذا الملف ⇒ ختمان
    minimumCalls: 2,
  },
  {
    file: 'src/app/auth/callback/route.ts',
    what: 'رابط الدعوة وإعادة تعيين كلمة المرور',
    creates: ['exchangeCodeForSession'],
    minimumCalls: 1,
  },
];

/**
 * عدّ **الاستدعاءات** لا الذكر.
 *
 * أول صياغة لهذا الحارس بحثت عن `stampSession` نصًّا، فمرّت على سطر
 * الاستيراد وحده ونجحت وإن حُذف كل استدعاء. أمسكها ضبطٌ سلبي، ولولاه
 * لبقي حارسٌ يحرس نفسه. والقوس هو الفرق: الاستيراد بلا قوس.
 */
function countCalls(source: string, fn: string): number {
  return source.split(`${fn}(`).length - 1;
}

function read(relative: string): string {
  return readFileSync(join(process.cwd(), relative), 'utf8');
}

describe('تغطية ختم الجلسة', () => {
  for (const entry of SESSION_CREATORS) {
    it(`${entry.what} يختم الجلسة`, () => {
      const source = read(entry.file);

      // الملف ينشئ جلسة فعلًا — وإلا فالفحص يمرّ على لا شيء
      const createsSession = entry.creates.some((api) => source.includes(api));
      expect(createsSession, `${entry.file} لم يعد ينشئ جلسة — راجع هذا الحارس`).toBe(true);

      expect(
        countCalls(source, 'stampSession'),
        `${entry.file} ينقصه استدعاء لـstampSession`,
      ).toBeGreaterThanOrEqual(entry.minimumCalls);
    });
  }

  it('الخروج يمحو الختم', () => {
    const source = read('src/app/(auth)/actions.ts');
    // مرّتان: الخروج العادي والخروج من كل الأجهزة
    expect(countCalls(source, 'clearSessionStamp')).toBeGreaterThanOrEqual(2);
  });

  it('الـmiddleware يفرض السياسة لا يقرؤها فقط', () => {
    const source = read('src/lib/supabase/middleware.ts');
    expect(countCalls(source, 'evaluateSession')).toBeGreaterThanOrEqual(1);
    expect(countCalls(source, 'decodeStamp')).toBeGreaterThanOrEqual(1);
  });

  it('انتهاء الجلسة يمحو كوكيات Supabase', () => {
    // تركها يجعل المتصفح يعيد إرسالها فيتكرر الفحص والإنهاء بلا نهاية
    const source = read('src/middleware.ts');
    expect(source).toContain("startsWith('sb-')");
    expect(source).toContain('maxAge: 0');
  });

  it('كل سبب إنهاء له رسالة معروضة', () => {
    const form = read('src/app/(auth)/login/login-form.tsx');

    for (const reason of Object.values(SESSION_END_REASONS)) {
      expect(form, `لا رسالة للسبب ${reason}`).toContain(`${reason}:`);
    }
  });
});

describe('الحارس نفسه يمسك النسيان — ضبط سلبي', () => {
  it('الاستيراد وحده لا يُعدّ ختمًا', () => {
    const importOnly = "import { stampSession } from '@/lib/auth/session-stamp';";
    expect(importOnly.split('stampSession(').length - 1).toBe(0);
    expect(importOnly.includes('stampSession')).toBe(true);
  });
});
