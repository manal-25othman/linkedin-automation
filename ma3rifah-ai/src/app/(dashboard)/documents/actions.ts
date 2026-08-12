'use server';

import { revalidatePath } from 'next/cache';
import { createHash } from 'node:crypto';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ingestDocumentNow, ingestDocument } from '@/lib/rag/ingest';
import {
  detectFileKind,
  MAX_FILE_SIZE_BYTES,
  SUPPORTED_EXTENSIONS,
} from '@/lib/rag/extract';
import { documentMetadataSchema, firstIssueMessage } from '@/lib/validation/schemas';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';
import { AppError, toAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { DocumentVisibility, UserRole } from '@/types/database';

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/** يمنع Path Traversal ويحافظ على امتداد الملف */
function safeFileName(original: string): string {
  const base = original.split(/[\\/]/).pop() ?? 'document';
  return base.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 120) || 'document';
}

export async function uploadDocumentAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('documents.manage');
    enforceRateLimit(`upload:${profile.id}`, RATE_LIMITS.upload);

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      throw new AppError('VALIDATION', 'اختر ملفًا للرفع.');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new AppError(
        'FILE_TOO_LARGE',
        `حجم الملف يتجاوز الحد المسموح (${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} ميجابايت).`,
      );
    }

    const kind = detectFileKind(file.name, file.type);
    if (!kind) {
      throw new AppError(
        'UNSUPPORTED_FILE',
        `نوع الملف غير مدعوم. الأنواع المدعومة: ${SUPPORTED_EXTENSIONS.join('، ')}`,
      );
    }

    const rawVisibility = String(formData.get('visibility') ?? 'COMPANY') as DocumentVisibility;
    const allowedDepartmentIds = formData
      .getAll('allowedDepartmentIds')
      .map(String)
      .filter(Boolean);
    const allowedRoles = formData.getAll('allowedRoles').map(String).filter(Boolean) as UserRole[];

    const parsed = documentMetadataSchema.safeParse({
      name: String(formData.get('name') || file.name),
      description: formData.get('description'),
      categoryId: formData.get('categoryId') || null,
      visibility: rawVisibility,
      allowedDepartmentIds,
      allowedRoles,
    });

    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const metadata = parsed.data;

    if (metadata.visibility === 'DEPARTMENT' && metadata.allowedDepartmentIds.length === 0) {
      throw new AppError('VALIDATION', 'اختر قسمًا واحدًا على الأقل عند تقييد الوصول بالأقسام.');
    }
    if (metadata.visibility === 'ROLE' && metadata.allowedRoles.length === 0) {
      throw new AppError('VALIDATION', 'اختر دورًا واحدًا على الأقل عند تقييد الوصول بالأدوار.');
    }

    // الأقسام المختارة يجب أن تنتمي لنفس الشركة
    if (metadata.allowedDepartmentIds.length > 0) {
      const supabase = await createClient();
      const { data: departments } = await supabase
        .from('departments')
        .select('id')
        .in('id', metadata.allowedDepartmentIds);

      if ((departments?.length ?? 0) !== metadata.allowedDepartmentIds.length) {
        throw new AppError('VALIDATION', 'أحد الأقسام المختارة غير صالح.');
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash('sha256').update(buffer).digest('hex');

    const admin = createAdminClient();

    // منع رفع نفس الملف مرتين
    const { data: duplicate } = await admin
      .from('documents')
      .select('id, name')
      .eq('company_id', company.id)
      .eq('checksum', checksum)
      .neq('status', 'ARCHIVED')
      .maybeSingle();

    if (duplicate) {
      throw new AppError(
        'VALIDATION',
        `هذا الملف مرفوع مسبقًا باسم «${duplicate.name}».`,
      );
    }

    const { data: document, error: insertError } = await admin
      .from('documents')
      .insert({
        company_id: company.id,
        category_id: metadata.categoryId || null,
        name: metadata.name,
        description: metadata.description || null,
        file_type: file.type || kind,
        file_size_bytes: file.size,
        checksum,
        status: 'PROCESSING',
        visibility: metadata.visibility,
        allowed_department_ids: metadata.allowedDepartmentIds,
        allowed_roles: metadata.allowedRoles,
        uploaded_by: profile.id,
      })
      .select('id')
      .single();

    if (insertError || !document) {
      logger.error('تعذّر إنشاء سجل المستند', { reason: insertError?.message });
      throw new AppError('INTERNAL');
    }

    // مسار التخزين يبدأ بمعرّف الشركة — وهذا ما تعتمد عليه سياسات التخزين
    const storagePath = `${company.id}/${document.id}/${safeFileName(file.name)}`;

    const { error: uploadError } = await admin.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      logger.error('تعذّر رفع الملف إلى التخزين', { reason: uploadError.message });
      await admin
        .from('documents')
        .update({ status: 'FAILED', error_message: 'تعذّر رفع الملف إلى التخزين.' })
        .eq('id', document.id);
      throw new AppError('INTERNAL', 'تعذّر رفع الملف. حاول مرة أخرى.');
    }

    await admin.from('documents').update({ storage_path: storagePath }).eq('id', document.id);

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'document.uploaded',
      entityType: 'document',
      entityId: document.id,
      metadata: { name: metadata.name, sizeBytes: file.size, visibility: metadata.visibility },
    });

    // تُنتظر المعالجة هنا عمدًا: إطلاقها في الخلفية يُقتل عند تجميد
    // الدالة بعد الرد، فيبقى المستند «جاري التحليل» أبدًا بلا خطأ.
    const failure = await ingestDocumentNow(document.id);

    revalidatePath('/documents');
    revalidatePath('/dashboard');

    return {
      ok: true,
      message: failure
        ? `تم رفع الملف لكن تعذّرت معالجته: ${failure}`
        : 'تم رفع المستند وإضافته إلى قاعدة المعرفة.',
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}

export async function reprocessDocumentAction(documentId: string): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('documents.manage');
    const admin = createAdminClient();

    // تحقق صريح من الملكية — العميل الإداري يتجاوز RLS
    const { data: document } = await admin
      .from('documents')
      .select('id, company_id')
      .eq('id', documentId)
      .maybeSingle();

    if (!document || document.company_id !== company.id) {
      throw new AppError('NOT_FOUND');
    }

    await admin
      .from('documents')
      .update({ status: 'PROCESSING', error_message: null })
      .eq('id', documentId);

    const failure = await ingestDocumentNow(documentId);
    revalidatePath('/documents');
    revalidatePath('/dashboard');

    logger.info('إعادة معالجة مستند', { documentId, actorId: profile.id });
    return {
      ok: true,
      message: failure ? `تعذّرت إعادة المعالجة: ${failure}` : 'اكتملت إعادة المعالجة.',
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}

/** معالجة متزامنة — يستخدمها سكربت البيانات التجريبية والاختبارات */
export async function processDocumentNow(documentId: string): Promise<ActionResult> {
  try {
    const { company } = await requirePermission('documents.manage');
    const admin = createAdminClient();

    const { data: document } = await admin
      .from('documents')
      .select('company_id')
      .eq('id', documentId)
      .maybeSingle();

    if (!document || document.company_id !== company.id) {
      throw new AppError('NOT_FOUND');
    }

    await ingestDocument(documentId);
    revalidatePath('/documents');
    return { ok: true };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}

export async function updateDocumentAction(
  documentId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('documents.manage');

    const parsed = documentMetadataSchema.safeParse({
      name: formData.get('name'),
      description: formData.get('description'),
      categoryId: formData.get('categoryId') || null,
      visibility: String(formData.get('visibility') ?? 'COMPANY'),
      allowedDepartmentIds: formData.getAll('allowedDepartmentIds').map(String).filter(Boolean),
      allowedRoles: formData.getAll('allowedRoles').map(String).filter(Boolean),
    });

    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const metadata = parsed.data;

    if (metadata.visibility === 'DEPARTMENT' && metadata.allowedDepartmentIds.length === 0) {
      throw new AppError('VALIDATION', 'اختر قسمًا واحدًا على الأقل.');
    }
    if (metadata.visibility === 'ROLE' && metadata.allowedRoles.length === 0) {
      throw new AppError('VALIDATION', 'اختر دورًا واحدًا على الأقل.');
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('documents')
      .update({
        name: metadata.name,
        description: metadata.description || null,
        category_id: metadata.categoryId || null,
        visibility: metadata.visibility,
        allowed_department_ids: metadata.allowedDepartmentIds,
        allowed_roles: metadata.allowedRoles as UserRole[],
      })
      .eq('id', documentId);

    if (error) throw error;

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'document.permissions_changed',
      entityType: 'document',
      entityId: documentId,
      metadata: { visibility: metadata.visibility },
    });

    revalidatePath('/documents');
    return { ok: true, message: 'تم تحديث المستند.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}

export async function archiveDocumentAction(documentId: string): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('documents.manage');
    const supabase = await createClient();

    const { error } = await supabase
      .from('documents')
      .update({ status: 'ARCHIVED' })
      .eq('id', documentId);

    if (error) throw error;

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'document.updated',
      entityType: 'document',
      entityId: documentId,
      metadata: { archived: true },
    });

    revalidatePath('/documents');
    return { ok: true, message: 'تمت أرشفة المستند وخرج من نطاق البحث.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}

export async function deleteDocumentAction(documentId: string): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('documents.manage');
    const admin = createAdminClient();

    const { data: document } = await admin
      .from('documents')
      .select('id, name, company_id, storage_path')
      .eq('id', documentId)
      .maybeSingle();

    if (!document || document.company_id !== company.id) {
      throw new AppError('NOT_FOUND');
    }

    if (document.storage_path) {
      await admin.storage.from('documents').remove([document.storage_path]);
    }

    // حذف السجل يحذف المقاطع المفهرسة معه (ON DELETE CASCADE)
    const { error } = await admin.from('documents').delete().eq('id', documentId);
    if (error) throw error;

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'document.deleted',
      entityType: 'document',
      entityId: documentId,
      metadata: { name: document.name },
    });

    revalidatePath('/documents');
    revalidatePath('/dashboard');
    return { ok: true, message: 'تم حذف المستند ومقاطعه من قاعدة المعرفة.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}

/** رابط تنزيل موقّع قصير الأجل */
export async function getDocumentDownloadUrl(
  documentId: string,
): Promise<{ ok: boolean; url?: string; message?: string }> {
  try {
    await requirePermission('documents.view');
    const supabase = await createClient();

    // RLS تمنع قراءة مستند لا يملك المستخدم صلاحيته
    const { data: document } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', documentId)
      .maybeSingle();

    if (!document?.storage_path) {
      throw new AppError('NOT_FOUND', 'الملف غير متاح للتنزيل.');
    }

    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from('documents')
      .createSignedUrl(document.storage_path, 120);

    if (error || !data) throw new AppError('INTERNAL', 'تعذّر إنشاء رابط التنزيل.');

    return { ok: true, url: data.signedUrl };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}
