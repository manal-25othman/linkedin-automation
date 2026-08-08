'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { departmentSchema, firstIssueMessage } from '@/lib/validation/schemas';
import { recordAudit } from '@/lib/audit';
import { AppError, toAppError } from '@/lib/errors';

export interface ActionResult {
  ok: boolean;
  message?: string;
}

function parse(formData: FormData) {
  const parsed = departmentSchema.safeParse({
    name: formData.get('name'),
    code: formData.get('code'),
    description: formData.get('description'),
  });
  if (!parsed.success) throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
  return parsed.data;
}

export async function createDepartmentAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('departments.manage');
    const input = parse(formData);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('departments')
      .insert({
        company_id: company.id,
        name: input.name,
        code: input.code || null,
        description: input.description || null,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError('VALIDATION', 'يوجد قسم بهذا الاسم بالفعل.');
      }
      throw error;
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'department.created',
      entityType: 'department',
      entityId: data.id,
      metadata: { name: input.name },
    });

    revalidatePath('/departments');
    return { ok: true, message: 'تم إنشاء القسم.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}

export async function updateDepartmentAction(
  departmentId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('departments.manage');
    const input = parse(formData);
    const supabase = await createClient();

    const { error } = await supabase
      .from('departments')
      .update({
        name: input.name,
        code: input.code || null,
        description: input.description || null,
      })
      .eq('id', departmentId);

    if (error) {
      if (error.code === '23505') {
        throw new AppError('VALIDATION', 'يوجد قسم بهذا الاسم بالفعل.');
      }
      throw error;
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'department.updated',
      entityType: 'department',
      entityId: departmentId,
      metadata: { name: input.name },
    });

    revalidatePath('/departments');
    return { ok: true, message: 'تم تحديث القسم.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}

export async function deleteDepartmentAction(departmentId: string): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('departments.manage');
    const supabase = await createClient();

    // القسم الذي لا يزال يضم موظفين لا يُحذف — الحذف سيفصلهم عن قسمهم بصمت
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', departmentId);

    if ((count ?? 0) > 0) {
      throw new AppError(
        'VALIDATION',
        `لا يمكن حذف القسم لوجود ${count} مستخدم مرتبط به. انقلهم إلى قسم آخر أولًا.`,
      );
    }

    const { error } = await supabase.from('departments').delete().eq('id', departmentId);
    if (error) throw error;

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'department.deleted',
      entityType: 'department',
      entityId: departmentId,
    });

    revalidatePath('/departments');
    return { ok: true, message: 'تم حذف القسم.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}
