import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toAppError } from '../../src/lib/errors';

/**
 * خطأ «القاعدة لم تُحدَّث».
 *
 * أكثر ما يُرى بعد نشرٍ لم تُشغَّل ترحيلاته: الشيفرة الجديدة تنادي جدولًا
 * لم يُنشأ بعد. وكانت الرسالة «حدث خطأ غير متوقع» — فتُضيّع ساعةً على من
 * يبحث عن عطل في الشيفرة، والعطل ليس فيها إنما في خطوةٍ لم تُنفَّذ.
 *
 * وهذا استثناء مقصود من قاعدة «لا تفاصيل تقنية للمستخدم»: المتلقّي هنا
 * مالكة المنصّة، والرسالة تخبرها بما تفعله لا بما انكسر.
 */

describe('كشف الترحيلة الناقصة', () => {
  it('42P01 — جدول غير موجود', () => {
    const error = toAppError({
      code: '42P01',
      message: 'relation "public.invite_codes" does not exist',
    });
    expect(error.code).toBe('SCHEMA_OUTDATED');
    expect(error.displayMessage).toContain('ALL_MIGRATIONS.sql');
  });

  it('42883 — دالّة غير موجودة', () => {
    const error = toAppError({ code: '42883', message: 'function does not exist' });
    expect(error.code).toBe('SCHEMA_OUTDATED');
  });

  it('42703 — عمود غير موجود', () => {
    const error = toAppError({ code: '42703', message: 'column does not exist' });
    expect(error.code).toBe('SCHEMA_OUTDATED');
  });

  it('رسالة PostgREST بلا رمز تُكشف كذلك', () => {
    // PostgREST يعيد أحيانًا رسالة بلا حقل code
    const error = toAppError({
      message: "Could not find the function public.invite_codes_report in the schema cache",
    });
    expect(error.code).toBe('SCHEMA_OUTDATED');
  });

  it('لا رقم مرجع لخطأ يُصلحه صاحبه بنفسه', () => {
    // الرقم لمن لا يستطيع الإصلاح؛ وهنا الإصلاح خطوة واحدة معلومة
    const error = toAppError({ code: '42P01', message: 'relation does not exist' });
    expect(error.displayMessage).not.toMatch(/ERR-/);
  });

  it('خطأ آخر يبقى INTERNAL — لا يُبتلع كل شيء', () => {
    // ضابط سالب: لولاه لصار كل خطأ «شغّلي الترحيلات»
    const error = toAppError(new Error('connection reset by peer'));
    expect(error.code).toBe('INTERNAL');
  });

  it('«does not exist» وحدها لا تكفي', () => {
    // «user does not exist» ليست ترحيلة ناقصة
    const error = toAppError({ message: 'user does not exist' });
    expect(error.code).toBe('INTERNAL');
  });
});

describe('بادئة رمز الدعوة لاتينية دائمًا', () => {
  const source = readFileSync(join(process.cwd(), 'src/app/admin/actions.ts'), 'utf8');

  it('يوجد جدول نقل للحروف العربية', () => {
    expect(source).toContain('ARABIC_TO_LATIN');
  });

  it('البادئة لا تُؤخذ من الاسم كما هو', () => {
    // «شركة خبراء الأعمال» كانت تُنتج `شركة-AKF4WZ`: رمز مختلط الاتجاه
    // يَنقلب ترتيبه عند النسخ في رسالة
    expect(source).not.toMatch(/replace\(\/\[\^A-Za-zء-ي\]\/g/);
  });

  it('أبجدية الرمز بلا حروف ملتبسة بصريًا', () => {
    const match = source.match(/CODE_ALPHABET = '([^']+)'/);
    expect(match).not.toBeNull();
    const alphabet = match![1];
    for (const confusing of ['0', 'O', '1', 'I', 'L']) {
      expect(alphabet, `الحرف ${confusing} ملتبس`).not.toContain(confusing);
    }
  });
});
