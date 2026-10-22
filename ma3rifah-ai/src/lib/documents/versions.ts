import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  DocApprovalStatus,
  DocVersionEvent,
} from '@/types/database';

/**
 * قراءة إصدارات الوثيقة وسجلّها.
 *
 * والمفهوم الذي يحمله هذا الملف كله: **صفّ `documents` إصدارٌ، والعائلة
 * هي الوثيقة.** فما يراه المستخدم «وثيقةً واحدة لها ثلاث نسخ» هو في
 * القاعدة عائلةٌ واحدة لها ثلاثة صفوف، أحدها مُشار إليه بوصفه الفعّال.
 *
 * ولا شيء هنا يتجاوز RLS: كل استعلام يمرّ بعميل المستخدم، فحدّ الشركة
 * مفروض في القاعدة لا في هذه الدوالّ.
 */

export interface DocumentVersion {
  id: string;
  versionLabel: string | null;
  approvalStatus: DocApprovalStatus;
  /** حالة الفهرسة — منفصلة عن الاعتماد */
  indexStatus: string;
  effectiveFrom: string | null;
  supersedesDocumentId: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  pageCount: number | null;
  charCount: number;
  chunkCount: number;
  fileSizeBytes: number;
  fileType: string;
  uploadedBy: string | null;
  createdAt: string;
  /** هل هو الإصدار الفعّال لعائلته */
  isEffective: boolean;
  /** هل يصلح للاعتماد الآن: مفهرس وليس معتمدًا بعد */
  canApprove: boolean;
}

export interface DocumentFamilyDetail {
  id: string;
  title: string;
  categoryId: string | null;
  departmentId: string | null;
  contentOwnerId: string | null;
  effectiveDocumentId: string | null;
  reviewIntervalMonths: number | null;
  reviewDueAt: string | null;
  lastReviewedAt: string | null;
  versions: DocumentVersion[];
}

export interface VersionEvent {
  id: string;
  event: DocVersionEvent;
  documentId: string | null;
  actorId: string | null;
  note: string | null;
  createdAt: string;
}

/** حالات الاعتماد التي تُعدّ «مرجعًا قابلًا للاعتماد» */
const APPROVABLE_FROM: DocApprovalStatus[] = [
  'DRAFT',
  'IN_REVIEW',
  'MIGRATED_UNREVIEWED',
];

/**
 * تفاصيل عائلة وإصداراتها.
 *
 * تُنادى بعميل المستخدم لا بمفتاح الخدمة: الوثيقة قد تكون محجوبة عنه
 * بالقسم أو الدور، وRLS هي التي تعرف ذلك.
 */
export async function getDocumentFamily(
  supabase: SupabaseClient<Database>,
  familyId: string,
): Promise<DocumentFamilyDetail | null> {
  const { data: family } = await supabase
    .from('document_families')
    .select(
      'id, title, category_id, department_id, content_owner_id, effective_document_id, review_interval_months, review_due_at, last_reviewed_at',
    )
    .eq('id', familyId)
    .maybeSingle();

  if (!family) return null;

  const { data: rows } = await supabase
    .from('documents')
    .select(
      'id, version_label, approval_status, status, effective_from, supersedes_document_id, approved_by, approved_at, page_count, char_count, chunk_count, file_size_bytes, file_type, uploaded_by, created_at',
    )
    .eq('family_id', familyId)
    .order('created_at', { ascending: false });

  const versions: DocumentVersion[] = (rows ?? []).map((row) => ({
    id: row.id,
    versionLabel: row.version_label,
    approvalStatus: row.approval_status,
    indexStatus: row.status,
    effectiveFrom: row.effective_from,
    supersedesDocumentId: row.supersedes_document_id,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    pageCount: row.page_count,
    charCount: row.char_count,
    chunkCount: row.chunk_count,
    fileSizeBytes: row.file_size_bytes,
    fileType: row.file_type,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    isEffective: family.effective_document_id === row.id,
    // الفهرسة شرط الاعتماد — والقاعدة ترفضه بدونها، فالزرّ لا يُعرض
    // أصلًا كي لا يصطدم المستخدم برفضٍ كان يمكن توقّعه.
    canApprove:
      row.status === 'READY' && APPROVABLE_FROM.includes(row.approval_status),
  }));

  return {
    id: family.id,
    title: family.title,
    categoryId: family.category_id,
    departmentId: family.department_id,
    contentOwnerId: family.content_owner_id,
    effectiveDocumentId: family.effective_document_id,
    reviewIntervalMonths: family.review_interval_months,
    reviewDueAt: family.review_due_at,
    lastReviewedAt: family.last_reviewed_at,
    versions,
  };
}

/** سجلّ أحداث العائلة — من رفع ومن اعتمد ومن أرشف ومتى */
export async function getFamilyEvents(
  supabase: SupabaseClient<Database>,
  familyId: string,
  limit = 50,
): Promise<VersionEvent[]> {
  const { data } = await supabase
    .from('document_version_events')
    .select('id, event, document_id, actor_id, note, created_at')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id,
    event: row.event,
    documentId: row.document_id,
    actorId: row.actor_id,
    note: row.note,
    createdAt: row.created_at,
  }));
}

/** عائلة إصدارٍ بعينه — لتحويل معرّف مستند إلى صفحة وثيقته */
export async function getFamilyIdForDocument(
  supabase: SupabaseClient<Database>,
  documentId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('documents')
    .select('family_id')
    .eq('id', documentId)
    .maybeSingle();

  return data?.family_id ?? null;
}

/** تسميات عربية لحالات الاعتماد */
export const APPROVAL_LABELS: Record<DocApprovalStatus, string> = {
  DRAFT: 'مسودة',
  IN_REVIEW: 'قيد المراجعة',
  APPROVED: 'معتمدة',
  ARCHIVED: 'مؤرشفة',
  SUPERSEDED: 'استُبدلت',
  MIGRATED_UNREVIEWED: 'لم يُسجَّل اعتمادها',
};

export const VERSION_EVENT_LABELS: Record<DocVersionEvent, string> = {
  UPLOADED: 'رُفع',
  SUBMITTED_FOR_REVIEW: 'أُرسل للمراجعة',
  APPROVED: 'اعتُمد',
  ARCHIVED: 'أُرشف',
  SUPERSEDED: 'استُبدل',
  REVIEWED_NO_CHANGE: 'روجع دون تغيير',
  FIRST_EFFECTIVE: 'صار المرجع الأول',
  MIGRATED: 'رُحّل من قبل نظام الإصدارات',
};
