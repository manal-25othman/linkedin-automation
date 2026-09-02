'use server';

import { revalidatePath } from 'next/cache';
import { createHash, randomUUID } from 'node:crypto';
import { requirePermission, getSessionContext } from '@/lib/auth/session';
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
import { enforceDocumentQuota, enforceStorageQuota } from '@/lib/billing/quota';
import { recordAudit } from '@/lib/audit';
import { notifyCompanyAdmins } from '@/lib/notifications';
import { AppError, sanitizeTechnicalDetail, toAppError } from '@/lib/errors';
import { safeStorageObjectName, isPathWithinCompany } from '@/lib/storage/object-name';
import { logger } from '@/lib/logger';
import type { DocumentVisibility, UserRole } from '@/types/database';

export interface ActionResult {
  ok: boolean;
  message?: string;
  /** معرّف المستند الذي أُنشئ أو عولج — لمتابعة معالجته من المتصفح */
  documentId?: string;
  /**
   * القراءة الضوئية لم تكتمل: قُرئ `done` من `total` صفحة. على المتصفح
   * أن ينادي continueProcessingAction ليُكمل — كل نداء يقرأ دفعة أخرى.
   */
  ocrPending?: { done: number; total: number } | null;
}


/**
 * ---------------------------------------------------------------------
 * الرفع لا يمرّ بالخادم
 *
 * تحدّ Vercel حجم أي طلب يصل دوالّها بـ٤٫٥ ميغابايت، ولا يمكن تجاوزها
 * بإعداد — `bodySizeLimit` في next.config لا أثر له هناك. فأي ملف أكبر
 * يُردّ بـ413 قبل أن تعمل شيفرتنا أصلًا، فلا تُنتَج رسالة خطأ ولا معرّف
 * حدث: تسقط الصفحة كلها بخطأ لا أثر له في السجل.
 *
 * وهذا ما أخفى العلة طويلًا: كل إصلاح سابق (بيئة PDF، والعامل، والاسم
 * العربي) يقع **بعد** وصول الملف — والملف لم يكن يصل.
 *
 * فصار المتصفح يرفع مباشرةً إلى Supabase Storage برابط موقّع، ولا يمرّ
 * الملف بـVercel إطلاقًا. ويبقى الخادم صاحب القرار في كل ما يهمّ:
 * الصلاحية، والحدود، ومسار التخزين، وقبول المستند في قاعدة المعرفة.
 * ---------------------------------------------------------------------
 */

export interface UploadTicket {
  ok: boolean;
  message?: string;
  ticket?: {
    /** المسار الذي سيُرفع إليه — يختاره الخادم لا العميل */
    path: string;
    /** رمز الرفع الموقّع، صالح لهذا المسار وحده */
    token: string;
  };
}

/**
 * تذكرة رفع: يتحقق الخادم من كل شيء عدا البايتات، ثم يأذن بمسار واحد.
 *
 * لا يُنشأ صفّ مستند هنا عمدًا: لو أغلق المستخدم اللسان بعد التذكرة
 * وقبل الرفع، لبقي صفّ «جاري التحليل» أبديّ لا ملف له. فيُنشأ الصفّ في
 * الخطوة الثانية حين يصير الملف موجودًا فعلًا.
 */
export async function createUploadTicketAction(input: {
  fileName: string;
  fileSize: number;
  fileType: string;
}): Promise<UploadTicket> {
  try {
    const { profile, company } = await requirePermission('documents.manage');
    await enforceRateLimit(`upload:${profile.id}`, RATE_LIMITS.upload);

    if (!input.fileName || !Number.isFinite(input.fileSize) || input.fileSize <= 0) {
      throw new AppError('VALIDATION', 'اختر ملفًا للرفع.');
    }

    if (input.fileSize > MAX_FILE_SIZE_BYTES) {
      throw new AppError(
        'FILE_TOO_LARGE',
        `حجم الملف يتجاوز الحد المسموح (${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} ميجابايت).`,
      );
    }

    const kind = detectFileKind(input.fileName, input.fileType);
    if (!kind) {
      throw new AppError(
        'UNSUPPORTED_FILE',
        `نوع الملف غير مدعوم. الأنواع المدعومة: ${SUPPORTED_EXTENSIONS.join('، ')}`,
      );
    }

    // الحدود تُفحص هنا بالحجم المُعلَن من العميل — وهو فحص مبكر للراحة
    // لا للأمان. الفحص الملزِم يقع في الإنهاء على الحجم الفعلي للكائن.
    await enforceDocumentQuota();
    await enforceStorageQuota(input.fileSize);

    // المسار يبدأ بمعرّف الشركة دائمًا، ويُولَّد جزؤه الأوسط عشوائيًا.
    // لا يشارك العميل في تكوينه، فلا يستطيع الكتابة في مسار شركة أخرى
    // ولا الكتابة فوق ملف قائم.
    const storagePath =
      `${company.id}/${randomUUID()}/${safeStorageObjectName(input.fileName)}`;

    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from('documents')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      logger.error('تعذّر إنشاء رابط رفع موقّع', { reason: error?.message });
      throw new AppError(
        'INTERNAL',
        `تعذّر تجهيز الرفع.\n\nتفصيل تقني: ${sanitizeTechnicalDetail(error?.message ?? '')}`,
      );
    }

    return { ok: true, ticket: { path: data.path, token: data.token } };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/**
 * إنهاء الرفع: يصير الملف مستندًا في قاعدة المعرفة.
 *
 * يُستدعى بعد أن يرفع المتصفح الملف إلى المسار المأذون. وحمولته صغيرة
 * (مسار وبيانات وصفية) فلا تصطدم بحدّ Vercel.
 */
export async function finalizeUploadAction(formData: FormData): Promise<ActionResult> {
  let storagePath = '';

  try {
    const { profile, company } = await requirePermission('documents.manage');
    storagePath = String(formData.get('storagePath') ?? '');

    // --- أهم فحص في هذا المسار ---
    // المسار يأتي من العميل، ولو قُبل كما هو لأمكن لمن يعرف مسار مستند
    // في شركة أخرى أن «ينهي رفعه» فينسخه إلى قاعدة معرفته هو. الاشتراط
    // أن يبدأ بمعرّف شركته يقطع ذلك من أصله.
    if (!isPathWithinCompany(storagePath, company.id)) {
      logger.warn('محاولة إنهاء رفع لمسار خارج الشركة', { actorId: profile.id });
      throw new AppError('FORBIDDEN', 'مسار الملف غير صالح.');
    }

    const rawVisibility = String(formData.get('visibility') ?? 'COMPANY') as DocumentVisibility;
    const allowedDepartmentIds = formData
      .getAll('allowedDepartmentIds')
      .map(String)
      .filter(Boolean);
    const allowedRoles = formData.getAll('allowedRoles').map(String).filter(Boolean) as UserRole[];

    const parsed = documentMetadataSchema.safeParse({
      name: String(formData.get('name') || ''),
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

    const admin = createAdminClient();

    // الملف يُقرأ من التخزين لا من الطلب: هذا اتصال خادم بخادم لا يخضع
    // لحدّ حجم الطلب، وهو أيضًا الطريق الوحيد لمعرفة الحجم الحقيقي
    // والبصمة — والعميل لا يُصدَّق في أيٍّ منهما.
    const { data: blob, error: downloadError } = await admin.storage
      .from('documents')
      .download(storagePath);

    if (downloadError || !blob) {
      throw new AppError(
        'VALIDATION',
        'لم يصل الملف إلى التخزين. أعد المحاولة.',
      );
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const checksum = createHash('sha256').update(buffer).digest('hex');
    const actualSize = buffer.byteLength;

    if (actualSize > MAX_FILE_SIZE_BYTES) {
      await admin.storage.from('documents').remove([storagePath]);
      throw new AppError(
        'FILE_TOO_LARGE',
        `حجم الملف يتجاوز الحد المسموح (${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} ميجابايت).`,
      );
    }

    // الفحص الملزِم للحدود: على الحجم الفعلي بعد وصول الملف
    try {
      await enforceStorageQuota(actualSize);
      await enforceDocumentQuota();
    } catch (quotaError) {
      await admin.storage.from('documents').remove([storagePath]);
      throw quotaError;
    }

    const { data: duplicate } = await admin
      .from('documents')
      .select('id, name')
      .eq('company_id', company.id)
      .eq('checksum', checksum)
      .neq('status', 'ARCHIVED')
      .maybeSingle();

    if (duplicate) {
      await admin.storage.from('documents').remove([storagePath]);
      throw new AppError('VALIDATION', `هذا الملف مرفوع مسبقًا باسم «${duplicate.name}».`);
    }

    const fileType = String(formData.get('fileType') || '') || blob.type || 'application/octet-stream';

    const { data: document, error: insertError } = await admin
      .from('documents')
      .insert({
        company_id: company.id,
        category_id: metadata.categoryId || null,
        name: metadata.name,
        description: metadata.description || null,
        file_type: fileType,
        file_size_bytes: actualSize,
        checksum,
        status: 'PROCESSING',
        storage_path: storagePath,
        visibility: metadata.visibility,
        allowed_department_ids: metadata.allowedDepartmentIds,
        allowed_roles: metadata.allowedRoles,
        uploaded_by: profile.id,
      })
      .select('id')
      .single();

    if (insertError || !document) {
      logger.error('تعذّر إنشاء سجل المستند', { reason: insertError?.message });
      await admin.storage.from('documents').remove([storagePath]);
      throw new AppError('INTERNAL');
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'document.uploaded',
      entityType: 'document',
      entityId: document.id,
      metadata: { name: metadata.name, sizeBytes: actualSize, visibility: metadata.visibility },
    });

    // تُنتظر المعالجة هنا عمدًا: إطلاقها في الخلفية يُقتل عند تجميد
    // الدالة بعد الرد، فيبقى المستند «جاري التحليل» أبدًا بلا خطأ.
    const { failure, ocrPending } = await ingestDocumentNow(document.id);

    // مستند فاشل يبقى فاشلًا بصمت لو لم يعد الرافع إلى الصفحة، فتظنّ
    // الشركة معرفتها مكتملة وهي ناقصة.
    if (failure) {
      await notifyCompanyAdmins({
        companyId: company.id,
        type: 'DOCUMENT_FAILED',
        title: `تعذّرت معالجة المستند «${metadata.name}»`,
        body: failure,
        link: '/documents',
        entityType: 'document',
        entityId: document.id,
      });
    }

    revalidatePath('/documents');
    revalidatePath('/dashboard');

    return {
      ok: true,
      documentId: document.id,
      ocrPending,
      message: failure
        ? `تم رفع الملف لكن تعذّرت معالجته: ${failure}`
        : ocrPending
          ? `الملف ممسوح ضوئيًا — جارٍ قراءته: ${ocrPending.done} من ${ocrPending.total} صفحة.`
          : 'تم رفع المستند وإضافته إلى قاعدة المعرفة.',
    };
  } catch (error) {

    // يُسجَّل الفشل المبكر — قبل إنشاء صفّ المستند — وإلا بدا في السجل
    // أن الشركة لم تحاول الرفع أصلًا. وغياب الأثر يُقرأ لاحقًا «لم
    // يجرّبوا»، وهو استنتاج خاطئ يضلّل الدعم بدل أن يعينه.
    const appError = toAppError(error);
    try {
      const session = await getSessionContext();
      if (session?.company) {
        await recordAudit({
          companyId: session.company.id,
          actorId: session.profile.id,
          actorEmail: session.profile.email,
          action: 'document.upload_failed',
          entityType: 'document',
          metadata: { code: appError.code },
        });
      }
    } catch {
      // تسجيل الأثر لا يجوز أن يبتلع سبب الفشل الأصلي
    }

    return { ok: false, message: appError.message };
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

    const { failure, ocrPending } = await ingestDocumentNow(documentId);
    revalidatePath('/documents');
    revalidatePath('/dashboard');

    logger.info('إعادة معالجة مستند', { documentId, actorId: profile.id });
    return {
      ok: true,
      documentId,
      ocrPending,
      message: failure
        ? `تعذّرت إعادة المعالجة: ${failure}`
        : ocrPending
          ? `جارٍ القراءة الضوئية: ${ocrPending.done} من ${ocrPending.total} صفحة.`
          : 'اكتملت إعادة المعالجة.',
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/**
 * متابعة معالجة مستند قراءتُه الضوئية لم تكتمل.
 *
 * يناديه المتصفح مرة بعد مرة حتى يعود بلا `ocrPending`. كل نداء يقرأ
 * دفعة صفحات ويخزّنها، فإن انقطع المتصفح في منتصفها بقي ما قُرئ، وأكمل
 * «إعادة المحاولة» من قائمة المستند ما تبقّى.
 *
 * لا يُقبل إلا لمستند شركة المستدعي وهو في حالة PROCESSING: مستند
 * جاهز أو فاشل لا «يُتابَع» بل يُعاد.
 */
export async function continueProcessingAction(documentId: string): Promise<ActionResult> {
  try {
    const { company } = await requirePermission('documents.manage');
    const admin = createAdminClient();

    const { data: document } = await admin
      .from('documents')
      .select('id, company_id, status')
      .eq('id', documentId)
      .maybeSingle();

    if (!document || document.company_id !== company.id) {
      throw new AppError('NOT_FOUND');
    }
    if (document.status !== 'PROCESSING') {
      return { ok: true, documentId, ocrPending: null, message: 'المستند لم يعد قيد المعالجة.' };
    }

    const { failure, ocrPending } = await ingestDocumentNow(documentId);
    revalidatePath('/documents');
    revalidatePath('/dashboard');

    return {
      ok: true,
      documentId,
      ocrPending,
      message: failure
        ? `تعذّرت المعالجة: ${failure}`
        : ocrPending
          ? `جارٍ القراءة الضوئية: ${ocrPending.done} من ${ocrPending.total} صفحة.`
          : 'اكتملت المعالجة وأُضيف المستند إلى قاعدة المعرفة.',
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
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
    return { ok: false, message: toAppError(error).displayMessage };
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
    return { ok: false, message: toAppError(error).displayMessage };
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
    return { ok: false, message: toAppError(error).displayMessage };
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
    return { ok: false, message: toAppError(error).displayMessage };
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
    return { ok: false, message: toAppError(error).displayMessage };
  }
}
