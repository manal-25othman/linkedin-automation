'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { ingestReferenceDocument } from '@/lib/knowledge/reference-library';
import { recordAudit } from '@/lib/audit';
import { AppError, toAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * إدارة المكتبة المرجعية — لمالكة المنصّة وحدها.
 *
 * الحارس مكرَّر عمدًا: تخطيط `/admin` يمنع غير `SUPER_ADMIN` من الوصول،
 * وسياسة القاعدة تمنع الكتابة، و`requireSuperAdmin` هنا ثالثٌ بينهما.
 * ونصّ نظاميّ خاطئ يصير سياسةَ شركةٍ معتمدة عند عميل — فالتكرار أرخص
 * من الثقة في طبقة واحدة.
 */

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export async function uploadReferenceDocumentAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { profile, company } = await requireSuperAdmin();

    const name = String(formData.get('name') ?? '').trim();
    const authority = String(formData.get('authority') ?? '').trim();
    const body = String(formData.get('body') ?? '');

    if (name.length < 4) throw new AppError('VALIDATION', 'اكتب اسم الوثيقة.');
    if (authority.length < 2) {
      throw new AppError('VALIDATION', 'اكتب الجهة المُصدِرة — تظهر في كل استشهاد.');
    }

    await ingestReferenceDocument({
      name,
      authority,
      referenceCode: String(formData.get('referenceCode') ?? '') || null,
      sourceUrl: String(formData.get('sourceUrl') ?? '') || null,
      description: String(formData.get('description') ?? '') || null,
      body,
      uploadedBy: profile.id,
    });

    await recordAudit({
      companyId: company?.id ?? null,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'reference.uploaded',
      entityType: 'platform_reference_document',
      entityId: null,
    });

    revalidatePath('/admin/reference');
    return { ok: true, message: 'رُفعت الوثيقة وفُهرست.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

export async function deleteReferenceDocumentAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { profile, company } = await requireSuperAdmin();
    const documentId = String(formData.get('documentId') ?? '').trim();
    if (!documentId) throw new AppError('VALIDATION', 'الوثيقة غير محدّدة.');

    const admin = createAdminClient();
    const { error } = await admin
      .from('platform_reference_documents')
      .delete()
      .eq('id', documentId);

    if (error) {
      logger.error('تعذّر حذف وثيقة مرجعية', { reason: error.message });
      return { ok: false, message: 'تعذّر حذف الوثيقة.' };
    }

    await recordAudit({
      companyId: company?.id ?? null,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'reference.deleted',
      entityType: 'platform_reference_document',
      entityId: documentId,
    });

    revalidatePath('/admin/reference');
    return { ok: true, message: 'حُذفت الوثيقة ومقاطعها.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}
