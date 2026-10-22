'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomUUID } from 'node:crypto';
import {
  ingestReferenceDocument,
  reindexReferenceDocument,
  ingestReferenceDocumentFromFile,
  REFERENCE_BUCKET,
} from '@/lib/knowledge/reference-library';
import { detectFileKind } from '@/lib/rag/extract';
import { safeStorageObjectName } from '@/lib/storage/object-name';
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


/** الحد الأعلى لملف مرجعي — الأنظمة ملفات كبيرة */
const MAX_REFERENCE_FILE_BYTES = 50 * 1024 * 1024;

export interface ReferenceUploadTicket {
  ok: boolean;
  ticket?: { path: string; token: string };
  message?: string;
}

/**
 * تذكرة رفع ملف مرجعي.
 *
 * المسار يُولَّد هنا بالكامل ولا يشارك العميل في تكوينه، فلا يكتب فوق
 * ملف قائم ولا يختار موضعه. والدلو خاص بلا سياسة لأي دور مصادَق،
 * فالرابط الموقّع هو الطريق الوحيد.
 */
export async function createReferenceUploadTicketAction(input: {
  fileName: string;
  fileSize: number;
  fileType: string;
}): Promise<ReferenceUploadTicket> {
  try {
    await requireSuperAdmin();

    if (!input.fileName || !Number.isFinite(input.fileSize) || input.fileSize <= 0) {
      throw new AppError('VALIDATION', 'اختر ملفًا للرفع.');
    }
    if (input.fileSize > MAX_REFERENCE_FILE_BYTES) {
      throw new AppError(
        'FILE_TOO_LARGE',
        `حجم الملف يتجاوز الحد المسموح (${MAX_REFERENCE_FILE_BYTES / 1024 / 1024} ميجابايت).`,
      );
    }

    const kind = detectFileKind(input.fileName, input.fileType);
    if (!kind || kind === 'image') {
      throw new AppError(
        'UNSUPPORTED_FILE',
        'ارفع ملف PDF أو Word، أو الصق النصّ مباشرةً.',
      );
    }

    const storagePath = `${randomUUID()}/${safeStorageObjectName(input.fileName)}`;

    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(REFERENCE_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      logger.error('تعذّر إنشاء رابط رفع مرجعي', { reason: error?.message });
      throw new AppError('INTERNAL', 'تعذّر تجهيز الرفع.');
    }

    return { ok: true, ticket: { path: data.path, token: data.token } };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/**
 * إنهاء رفع ملف مرجعي: يُستخرج نصّه بخطّ المعالجة نفسه الذي تمرّ به
 * مستندات الشركات — بإصلاح PDF العربي والقراءة الضوئية وقياس الجودة.
 */
export async function finalizeReferenceUploadAction(
  formData: FormData,
): Promise<ActionResult> {
  const storagePath = String(formData.get('storagePath') ?? '').trim();

  try {
    const { profile } = await requireSuperAdmin();

    const name = String(formData.get('name') ?? '').trim();
    const authority = String(formData.get('authority') ?? '').trim();

    if (!name || !authority) {
      throw new AppError('VALIDATION', 'اسم الوثيقة والجهة المُصدِرة مطلوبان.');
    }
    if (!storagePath) {
      throw new AppError('VALIDATION', 'لم يصل الملف. أعد المحاولة.');
    }

    const documentId = await ingestReferenceDocumentFromFile({
      name,
      authority,
      referenceCode: String(formData.get('referenceCode') ?? '') || null,
      sourceUrl: String(formData.get('sourceUrl') ?? '') || null,
      description: String(formData.get('description') ?? '') || null,
      storagePath,
      fileName: String(formData.get('fileName') ?? '') || 'document.pdf',
      mimeType: String(formData.get('fileType') ?? '') || undefined,
      uploadedBy: profile.id,
    });

    await recordAudit({
      companyId: null,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'reference.uploaded',
      entityType: 'platform_reference_document',
      entityId: documentId,
      metadata: { name, authority, viaFile: true },
    });

    revalidatePath('/admin/reference');
    return { ok: true, message: 'رُفعت الوثيقة واستُخرج نصّها وفُهرست.' };
  } catch (error) {
    // الملف لا يُترك في التخزين بعد فشل الفهرسة: ملفٌّ بلا صفّ لا
    // يصل إليه شيء ولا يحذفه أحد.
    if (storagePath) {
      await createAdminClient()
        .storage.from(REFERENCE_BUCKET)
        .remove([storagePath])
        .catch(() => undefined);
    }
    return { ok: false, message: toAppError(error).displayMessage };
  }
}


export interface ReferenceChunkPreview {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  hasEmbedding: boolean;
}

/**
 * معاينة ما فُهرس — لا ما رُفع.
 *
 * والفرق جوهريّ: الاستخراج قد يُسقط جدولًا أو يخلط عمودًا، والمعاينة
 * هي ما يكشفه. ورفعٌ يقول «منشورة» بلا دليل على محتواه ثقةٌ عمياء في
 * نصٍّ تُبنى عليه سياسات شركات.
 */
export async function previewReferenceChunksAction(documentId: string): Promise<{
  ok: boolean;
  chunks?: ReferenceChunkPreview[];
  message?: string;
}> {
  try {
    await requireSuperAdmin();

    if (!documentId) throw new AppError('VALIDATION', 'الوثيقة غير محدّدة.');

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('preview_reference_chunks', {
      p_document_id: documentId,
      p_limit: 20,
    });

    if (error) {
      logger.error('تعذّرت معاينة المقاطع', { reason: error.message });
      return { ok: false, message: 'تعذّرت المعاينة.' };
    }

    return {
      ok: true,
      chunks: (data ?? []).map((row) => ({
        chunkIndex: row.chunk_index,
        content: row.content,
        tokenCount: row.token_count,
        hasEmbedding: row.has_embedding,
      })),
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/**
 * إعادة الفهرسة.
 *
 * أكثر أسباب الفشل شيوعًا حدّ معدّل مزوّد التضمين — عطلٌ عابر لا علاقة
 * له بالمحتوى، وكان يوجب الحذف وإعادة الرفع من الصفر.
 */
export async function reindexReferenceDocumentAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { profile } = await requireSuperAdmin();

    const documentId = String(formData.get('documentId') ?? '').trim();
    if (!documentId) throw new AppError('VALIDATION', 'الوثيقة غير محدّدة.');

    const chunkCount = await reindexReferenceDocument(documentId);

    await recordAudit({
      companyId: null,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'reference.uploaded',
      entityType: 'platform_reference_document',
      entityId: documentId,
      metadata: { reindexed: true, chunkCount },
    });

    revalidatePath('/admin/reference');
    return { ok: true, message: `أُعيدت الفهرسة — ${chunkCount} مقطعًا.` };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}
