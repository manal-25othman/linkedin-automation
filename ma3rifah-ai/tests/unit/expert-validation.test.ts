import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * حارس مساحة الخبراء.
 *
 * الميزة تمنح موظفًا — قد يكون بلا أي صلاحية إدارية — حقًّا على صفٍّ
 * في جدول الفجوات. وأخطر ما فيها ثلاثة أخطاء يسهل الوقوع في كلٍّ منها
 * وهي لا تظهر في التشغيل:
 *
 *   • أن تُوسَّع سياسة الكتابة لتشمله، فيصير قادرًا على تغيير الحالة
 *     والإجابة المعتمدة والإسناد نفسه لا مسوّدته فقط.
 *   • أن يُكتب صفُّه من الخادم مباشرة بدل الدالّة، فيسقط التحقق من
 *     الإسناد إن أخطأ سطرٌ في الإجراء.
 *   • أن تُكتب مسوّدته في `answer_text`، فتدخل قاعدة المعرفة قبل أن
 *     يراها المدير — وهي بالضبط الحالة التي بُنيت الميزة لمنعها.
 *
 * وكلها مفحوصة عمليًّا في `tests/sql/11`، وهذا الحارس يمسكها في الشيفرة
 * قبل أن تصل قاعدة البيانات.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const MIGRATION = read('supabase/migrations/0038_expert_validation.sql');
const EXPERT_ACTION = read('src/app/(dashboard)/assigned/actions.ts');
const ASSIGN_ACTION = read('src/app/(dashboard)/knowledge-gaps/actions.ts');
const ASSIGNED_PAGE = read('src/app/(dashboard)/assigned/page.tsx');

describe('الهجرة لا توسّع الكتابة', () => {
  it('سياسة الكتابة لم تُمسّ — تبقى على مديري الشركة', () => {
    // إعادة تعريفها هنا بأي صيغة تعني أن الخبير قد يكتب في الصفّ كلّه
    expect(MIGRATION).not.toMatch(/create policy knowledge_gaps_write/);
  });

  it('سياسة القراءة تُبقي شرط الشركة قبل شرط الإسناد', () => {
    const policy = MIGRATION.slice(
      MIGRATION.indexOf('create policy knowledge_gaps_select'),
      MIGRATION.indexOf('-- سياسة الكتابة لم تُمسّ'),
    );
    expect(policy).toContain('belongs_to_current_company(company_id)');
    expect(policy).toContain('assigned_to = auth.uid()');
    // الشركة شرطٌ مقترن لا بديل: `or` بينهما يفتح الجدول بين الشركات
    expect(policy).toMatch(/belongs_to_current_company\(company_id\)\s*\n?\s*and \(/);
  });

  it('الدالّة تتحقق من الشركة ومن الإسناد معًا', () => {
    const fn = MIGRATION.slice(MIGRATION.indexOf('create or replace function public.submit_expert_answer'));
    expect(fn).toContain('company_id = v_company');
    expect(fn).toContain('assigned_to = auth.uid()');
  });

  it('الدالّة تكتب عمودَي المسوّدة لا غير', () => {
    const fn = MIGRATION.slice(MIGRATION.indexOf('create or replace function public.submit_expert_answer'));
    const setClause = fn.slice(fn.indexOf('set expert_answer'), fn.indexOf('where id = p_gap_id'));
    for (const forbidden of ['answer_text', 'status', 'assigned_to', 'answer_document_id']) {
      expect(setClause, `الدالّة تكتب ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('الدالّة محجوبة عن العموم ومفتوحة للمسجَّلين', () => {
    expect(MIGRATION).toContain('revoke all on function public.submit_expert_answer(uuid, text) from public');
    expect(MIGRATION).toContain('grant execute on function public.submit_expert_answer(uuid, text) to authenticated');
  });
});

describe('إجراء الخبير', () => {
  it('لا يشترط صلاحية إدارية — الحقّ من الإسناد لا من الدور', () => {
    expect(EXPERT_ACTION).toContain('requireCompanySession');
    expect(EXPERT_ACTION).not.toContain('requirePermission');
  });

  it('يكتب عبر الدالّة لا بتحديث مباشر على الجدول', () => {
    expect(EXPERT_ACTION).toContain("rpc('submit_expert_answer'");
    expect(EXPERT_ACTION).not.toMatch(/from\('knowledge_gaps'\)[\s\S]{0,40}\.update\(/);
  });

  it('لا يمسّ الإجابة المعتمدة ولا ينشر في قاعدة المعرفة', () => {
    expect(EXPERT_ACTION).not.toContain('answer_text');
    expect(EXPERT_ACTION).not.toContain('upsertCuratedAnswer');
  });

  it('يفشل بصراحة إن ردّت الدالّة أن الإسناد رُفع', () => {
    expect(EXPERT_ACTION).toMatch(/if \(!written\)/);
  });
});

describe('إجراء التوجيه', () => {
  it('محصور في من يملك إدارة الفجوات', () => {
    const action = ASSIGN_ACTION.slice(ASSIGN_ACTION.indexOf('export async function assignGapAction'));
    expect(action).toContain("requirePermission('knowledge_gaps.manage')");
  });

  it('يتحقق أن الخبير نشِط قبل الإسناد', () => {
    const action = ASSIGN_ACTION.slice(ASSIGN_ACTION.indexOf('export async function assignGapAction'));
    expect(action).toContain("status !== 'ACTIVE'");
  });

  it('رفع الإسناد يمحو مسوّدة من لم يعد مسؤولًا', () => {
    const action = ASSIGN_ACTION.slice(ASSIGN_ACTION.indexOf('export async function assignGapAction'));
    expect(action).toMatch(/expert_answer: expertId \? undefined : null/);
  });
});

describe('صفحة الخبير', () => {
  it('تُقرأ بجلسة المستخدم لا بعميل الإدارة', () => {
    expect(ASSIGNED_PAGE).toContain("from '@/lib/supabase/server'");
    expect(ASSIGNED_PAGE).not.toContain('createAdminClient');
  });

  it('تُرشَّح بالمستخدم نفسه', () => {
    expect(ASSIGNED_PAGE).toContain("eq('assigned_to', profile.id)");
  });

  it('لا تقرأ الملاحظة الإدارية ولا حالة الفجوة الداخلية للعرض', () => {
    // ملاحظة المعالجة إدارية صريحة: «لا يراها الموظفون»
    expect(ASSIGNED_PAGE).not.toContain('resolution_note');
  });
});
