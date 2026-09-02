import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * أول ملاحظة من مجرّب حقيقي: خطأ في كلمة المرور كان يمسح النموذج كله
 * ويعيد صاحبه للسطر الأول. useActionState يعيد تركيب النموذج بعد كل
 * إرسال — فالقيم يجب أن تعود من الخادم مع الخطأ وتُعبَّأ من جديد.
 */

const ACTIONS = readFileSync(join(process.cwd(), 'src/app/(auth)/actions.ts'), 'utf8');
const FORM = readFileSync(
  join(process.cwd(), 'src/app/(auth)/register/register-form.tsx'),
  'utf8',
);
const EXPORT_ROUTE = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/knowledge-gaps/export/route.ts'),
  'utf8',
);

function registerActionBlock(): string {
  const start = ACTIONS.indexOf('export async function registerAction');
  const next = ACTIONS.indexOf('export async function', start + 10);
  return next === -1 ? ACTIONS.slice(start) : ACTIONS.slice(start, next);
}

describe('خطأ التسجيل لا يمسح النموذج', () => {
  const block = registerActionBlock();

  it('كل خطأ في registerAction يعيد القيم المكتوبة', () => {
    const errorReturns = block.match(/status: 'error'/g) ?? [];
    const withValues = block.match(/status: 'error'[^}]*values/gs) ?? [];
    expect(errorReturns.length).toBeGreaterThan(3);
    expect(withValues.length).toBe(errorReturns.length);
  });

  it('كلمة المرور لا تُحفظ ولا تُعاد أبدًا', () => {
    const keep = block.slice(block.indexOf('const keep'), block.indexOf('registerSchema'));
    expect(keep).not.toContain('password');
  });

  it('النموذج يعبّئ الحقول من القيم العائدة', () => {
    for (const field of ['fullName', 'companyName', 'jobTitle', 'email', 'inviteCode']) {
      expect(FORM, `حقل ${field} لا يقرأ state.values`).toContain(`state.values?.${field}`);
    }
  });

  it('كلمة المرور تُفحص قبل مغادرة المتصفح — الخطأ الأشيع لا يذهب للخادم', () => {
    expect(FORM).toContain('checkPasswordBeforeSubmit');
    expect(FORM).toContain('event.preventDefault()');
  });
});

describe('تصدير الفجوات محروس', () => {
  it('المسار يفحص الصلاحية قبل أي استعلام', () => {
    expect(EXPORT_ROUTE).toContain("requirePermission('knowledge_gaps.view')");
    expect(EXPORT_ROUTE.indexOf('requirePermission')).toBeLessThan(
      EXPORT_ROUTE.indexOf('createClient()'),
    );
  });

  it('الاستعلام بجلسة المستخدم لا بمفتاح الخدمة — RLS تحصره في شركته', () => {
    expect(EXPORT_ROUTE).not.toContain('createAdminClient');
  });
});
