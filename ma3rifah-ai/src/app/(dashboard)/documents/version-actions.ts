'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { recordAudit } from '@/lib/audit';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { AppError, toAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * إجراءات الإصدارات: الاعتماد والأرشفة وحوكمة المراجعة.
 *
 * كلها خلف `documents.manage` — ولم تُنشأ صلاحية جديدة: من يملك إدارة
 * المستندات يملك تقرير أيّها مرجع الشركة، وهو القرار نفسه بصيغة أدقّ.
 *
 * ولا يُحسب شيء هنا في التطبيق: الاعتماد والأرشفة دالّتان في القاعدة،
 * فتبديل المرجع يقع في معاملة واحدة. ولو وُزّع على نداءين من هنا لظهرت
 * **فترة خليط** تُجيب فيها المنصّة من نسختين — وهي العلّة التي يمنعها
 * التصميم كله.
 */

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/** رسائل أخطاء القاعدة المعروفة — ولا يُعرض نصّ الاستثناء للمستخدم */
function friendlyError(raw: string): string {
  if (raw.includes('document_not_indexed')) {
    return 'لم تكتمل معالجة هذا الإصدار بعد. لا يُعتمد قبل أن يصبح قابلًا للبحث.';
  }
  if (raw.includes('effective_version_not_indexed')) {
    return 'لا يمكن اعتماد إصدار لم تكتمل معالجته.';
  }
  if (raw.includes('not_authorized')) {
    return 'لا تملك صلاحية اعتماد الإصدارات.';
  }
  if (raw.includes('document_not_found')) {
    return 'الإصدار غير موجود.';
  }
  return 'تعذّر تنفيذ الإجراء.';
}

/**
 * اعتماد إصدار — الخطوة الوحيدة التي تبدّل مرجع الشركة.
 *
 * ولا يُعتمد شيء تلقائيًا بعد المقارنة: المقارنة تُظهر الفرق، والاعتماد
 * قرار إنسان. ولذلك هذا إجراء منفصل لا نتيجةٌ لإجراء آخر.
 */
export async function approveVersionAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('documents.manage');
    await enforceRateLimit(`doc-approve:${profile.id}`, RATE_LIMITS.mutation);

    const documentId = String(formData.get('documentId') ?? '').trim();
    if (!documentId) throw new AppError('VALIDATION', 'الإصدار غير محدّد.');

    const rawDate = String(formData.get('effectiveFrom') ?? '').trim();
    const note = String(formData.get('note') ?? '').trim() || null;

    const supabase = await createClient();
    const { data: familyId, error } = await supabase.rpc('approve_document_version', {
      p_document_id: documentId,
      p_effective_from: rawDate || null,
      p_note: note,
    });

    if (error) {
      logger.warn('تعذّر اعتماد إصدار', { reason: error.message });
      return { ok: false, message: friendlyError(error.message) };
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'document.version_approved',
      entityType: 'document',
      entityId: documentId,
      // لا يُنسخ محتوى الوثيقة إلى السجلّ — المعرّفات وحدها
      metadata: { familyId },
    });

    revalidatePath('/documents');
    if (familyId) revalidatePath(`/documents/${familyId}`);
    return { ok: true, message: 'اعتُمد الإصدار وصار مرجع الشركة لهذه الوثيقة.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/** أرشفة إصدار. ولو كان هو المرجع، بقيت الوثيقة بلا مرجع — وهذا معلَن */
export async function archiveVersionAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('documents.manage');
    await enforceRateLimit(`doc-archive:${profile.id}`, RATE_LIMITS.mutation);

    const documentId = String(formData.get('documentId') ?? '').trim();
    if (!documentId) throw new AppError('VALIDATION', 'الإصدار غير محدّد.');

    const supabase = await createClient();

    /*
     * يُقرأ قبل الأرشفة: بعدها يصير المؤشّر فارغًا فلا يُعرف أثرها.
     *
     * واستعلامان لا علاقةٌ مضمَّنة: نوع `Table<Row>` في المشروع يعلن
     * `Relationships: []`، فالعلاقات المضمَّنة لا تُستنتج أنواعها.
     */
    const { data: before } = await supabase
      .from('documents')
      .select('family_id')
      .eq('id', documentId)
      .maybeSingle();

    let wasEffective = false;
    if (before?.family_id) {
      const { data: family } = await supabase
        .from('document_families')
        .select('effective_document_id')
        .eq('id', before.family_id)
        .maybeSingle();
      wasEffective = family?.effective_document_id === documentId;
    }

    const { error } = await supabase.rpc('archive_document_version', {
      p_document_id: documentId,
      p_note: String(formData.get('note') ?? '').trim() || null,
    });

    if (error) {
      logger.warn('تعذّرت أرشفة إصدار', { reason: error.message });
      return { ok: false, message: friendlyError(error.message) };
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'document.version_archived',
      entityType: 'document',
      entityId: documentId,
    });

    revalidatePath('/documents');
    if (before?.family_id) revalidatePath(`/documents/${before.family_id}`);

    return {
      ok: true,
      message: wasEffective
        ? 'أُرشف الإصدار. ولم يبق لهذه الوثيقة مرجع معتمد — اعتمد إصدارًا آخر.'
        : 'أُرشف الإصدار.',
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/**
 * حوكمة الوثيقة: مسؤول المحتوى ودورة المراجعة.
 *
 * ومسؤول المحتوى يُفحَص انتماؤه للشركة: المعرّف يأتي من النموذج، وتعيين
 * شخصٍ من شركة أخرى مسؤولًا يُرسل إليه تنبيهًا عن وثيقة لا يراها.
 */
export async function updateFamilyGovernanceAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('documents.manage');

    const familyId = String(formData.get('familyId') ?? '').trim();
    if (!familyId) throw new AppError('VALIDATION', 'الوثيقة غير محدّدة.');

    const ownerId = String(formData.get('contentOwnerId') ?? '').trim() || null;
    const rawInterval = String(formData.get('reviewIntervalMonths') ?? '').trim();
    const interval = rawInterval ? Number(rawInterval) : null;

    if (interval !== null && (!Number.isInteger(interval) || interval < 1 || interval > 120)) {
      throw new AppError('VALIDATION', 'دورة المراجعة بالأشهر بين ١ و١٢٠.');
    }

    const supabase = await createClient();

    if (ownerId) {
      const { data: owner } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', ownerId)
        .eq('company_id', company.id)
        .maybeSingle();

      if (!owner) throw new AppError('VALIDATION', 'مسؤول المحتوى غير صالح.');
    }

    const reviewDueAt =
      interval !== null
        ? new Date(Date.now() + interval * 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10)
        : null;

    const { error } = await supabase
      .from('document_families')
      .update({
        content_owner_id: ownerId,
        review_interval_months: interval,
        // موعد المراجعة يُحتسب من الآن عند ضبط الدورة. ولو أُلغيت
        // الدورة أُلغي الموعد معها، فلا يبقى تنبيهٌ بلا سببٍ قائم.
        review_due_at: reviewDueAt,
      })
      .eq('id', familyId)
      .eq('company_id', company.id);

    if (error) {
      logger.warn('تعذّر تحديث حوكمة الوثيقة', { reason: error.message });
      return { ok: false, message: 'تعذّر حفظ الإعدادات.' };
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'document.governance_updated',
      entityType: 'document_family',
      entityId: familyId,
    });

    revalidatePath(`/documents/${familyId}`);
    return { ok: true, message: 'حُفظت إعدادات المراجعة.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}
