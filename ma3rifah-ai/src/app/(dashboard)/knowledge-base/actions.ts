'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { categorySchema, firstIssueMessage } from '@/lib/validation/schemas';
import { recordAudit } from '@/lib/audit';
import { AppError, toAppError } from '@/lib/errors';

export interface ActionResult {
  ok: boolean;
  message?: string;
}

function parse(formData: FormData) {
  const parsed = categorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    color: formData.get('color'),
  });
  if (!parsed.success) throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
  return parsed.data;
}

export async function createCategoryAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('categories.manage');
    const input = parse(formData);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('knowledge_categories')
      .insert({
        company_id: company.id,
        name: input.name,
        description: input.description || null,
        color: input.color || null,
        created_by: profile.id,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError('VALIDATION', 'يوجد تصنيف بهذا الاسم بالفعل.');
      }
      throw error;
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'category.created',
      entityType: 'knowledge_category',
      entityId: data.id,
      metadata: { name: input.name },
    });

    revalidatePath('/knowledge-base');
    revalidatePath('/documents');
    return { ok: true, message: 'تم إنشاء التصنيف.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

export async function updateCategoryAction(
  categoryId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('categories.manage');
    const input = parse(formData);
    const supabase = await createClient();

    const { error } = await supabase
      .from('knowledge_categories')
      .update({
        name: input.name,
        description: input.description || null,
        color: input.color || null,
      })
      .eq('id', categoryId);

    if (error) {
      if (error.code === '23505') {
        throw new AppError('VALIDATION', 'يوجد تصنيف بهذا الاسم بالفعل.');
      }
      throw error;
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'category.updated',
      entityType: 'knowledge_category',
      entityId: categoryId,
      metadata: { name: input.name },
    });

    revalidatePath('/knowledge-base');
    return { ok: true, message: 'تم تحديث التصنيف.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('categories.manage');
    const supabase = await createClient();

    // المستندات لا تُحذف — تُفصل عن التصنيف فقط (ON DELETE SET NULL)
    const { count } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', categoryId);

    const { error } = await supabase
      .from('knowledge_categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'category.deleted',
      entityType: 'knowledge_category',
      entityId: categoryId,
      metadata: { detachedDocuments: count ?? 0 },
    });

    revalidatePath('/knowledge-base');
    revalidatePath('/documents');
    return {
      ok: true,
      message:
        (count ?? 0) > 0
          ? `تم حذف التصنيف. ${count} مستند أصبح بلا تصنيف ولم يُحذف.`
          : 'تم حذف التصنيف.',
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}
