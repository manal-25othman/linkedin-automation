import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * بوّابة التسجيل.
 *
 * الغرض منها أن يبقى الباب مغلقًا على من لم يُدعَ في مرحلة التجربة —
 * فرابطُ التسجيل الذي يُشارَك في مجموعة واحدة لا يُنشئ حسابًا.
 *
 * وأهمّ ما يُختبر هنا **اتجاه الافتراض**: متغيّر بيئة غائب أو مكتوب
 * خطأً يجب أن يعني «مغلق» لا «مفتوح». وخطأُ إعدادٍ يمنع تسجيلًا مشروعًا
 * يُكتشف في دقائق ويُصلَح، وخطأٌ يفتح الباب للعالم لا يُكتشف إلا بعد
 * أن يدخل من دخل.
 */

async function loadModule(mode?: string) {
  vi.resetModules();
  if (mode === undefined) delete process.env.REGISTRATION_MODE;
  else process.env.REGISTRATION_MODE = mode;
  return import('../../src/lib/auth/invite');
}

afterEach(() => {
  delete process.env.REGISTRATION_MODE;
  vi.resetModules();
});

describe('اتجاه الافتراض — مغلق لا مفتوح', () => {
  it('بلا متغيّر بيئة: التسجيل بدعوة', async () => {
    const { registrationMode, inviteRequired } = await loadModule(undefined);
    expect(registrationMode()).toBe('invite');
    expect(inviteRequired()).toBe(true);
  });

  it('قيمة مكتوبة خطأً: التسجيل بدعوة', async () => {
    const { inviteRequired } = await loadModule('opne');
    expect(inviteRequired()).toBe(true);
  });

  it('قيمة فارغة: التسجيل بدعوة', async () => {
    const { inviteRequired } = await loadModule('');
    expect(inviteRequired()).toBe(true);
  });

  it('«open» صراحةً — وهي الصيغة الوحيدة التي تفتح', async () => {
    const { registrationMode, inviteRequired } = await loadModule('open');
    expect(registrationMode()).toBe('open');
    expect(inviteRequired()).toBe(false);
  });

  it('«OPEN» بأحرف كبيرة لا تفتح — المطابقة حرفية', async () => {
    // التساهل هنا يفتح الباب بخطأ كتابة، والتشدّد يمنع تسجيلًا يُصلَح
    const { inviteRequired } = await loadModule('OPEN');
    expect(inviteRequired()).toBe(true);
  });
});

describe('الفحص يجري في الإجراء لا في الواجهة', () => {
  const action = readFileSync(
    join(process.cwd(), 'src/app/(auth)/actions.ts'),
    'utf8',
  );

  it('registerAction يفحص الدعوة', () => {
    expect(action).toContain('inviteRequired()');
    expect(action).toContain('checkInviteCode(');
  });

  it('الفحص يسبق إنشاء الحساب', () => {
    // التحقّق بعد `signUp` يترك حسابًا يتيمًا في Supabase Auth بلا شركة،
    // فيتعذّر على صاحبه التسجيل ثانيةً بالبريد نفسه ولو حصل على دعوة
    const check = action.indexOf('checkInviteCode(');
    const signUp = action.indexOf('auth.signUp(');
    expect(check).toBeGreaterThan(-1);
    expect(signUp).toBeGreaterThan(-1);
    expect(check).toBeLessThan(signUp);
  });

  it('الاستهلاك يلي التجهيز لا يسبقه', () => {
    // لو استُهلك قبله لأحرق فشلُ التجهيز دعوةً كاملة
    expect(action.indexOf('redeemInviteCode(')).toBeGreaterThan(
      action.indexOf('bootstrapCompany('),
    );
  });

  it('الرمز لا يُكتب في السجلّات', () => {
    // السجلّات تُقرأ وتُصدَّر، والرمز مفتاح باب
    const invite = readFileSync(join(process.cwd(), 'src/lib/auth/invite.ts'), 'utf8');
    expect(invite).not.toMatch(/logger\.[a-z]+\([^)]*\bcode\b/);
  });
});
