import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/shared/page-header';
import { ReferenceClient, type ReferenceDocumentView } from './reference-client';

export const metadata: Metadata = { title: 'المكتبة المرجعية' };
export const dynamic = 'force-dynamic';

/**
 * المكتبة المرجعية الرسمية — شاشة مالكة المنصّة.
 *
 * تُقرأ بمفتاح الخدمة لا بجلسة المستخدم: سياسة القراءة تُظهر المنشور
 * وحده، والمالكة تحتاج أن ترى ما فشلت فهرسته لتعيد رفعه. وتخطيط
 * `/admin` يمنع غير `SUPER_ADMIN` من بلوغ هذه الصفحة أصلًا.
 */
export default async function ReferenceLibraryPage() {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from('platform_reference_documents')
    .select('id, name, authority, reference_code, source_url, status, file_size_bytes, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const documents: ReferenceDocumentView[] = (data ?? []).map((doc) => ({
    id: doc.id,
    name: doc.name,
    authority: doc.authority,
    referenceCode: doc.reference_code,
    sourceUrl: doc.source_url,
    status: doc.status,
    sizeBytes: doc.file_size_bytes,
    createdAt: doc.created_at,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="المكتبة المرجعية الرسمية"
        description="نصوص نظامية عامة تقرؤها كل الشركات قراءةً فقط، ويستند إليها استوديو السياسات في الاستشهاد. لا تدخل بحث المساعد العادي."
      />
      <ReferenceClient documents={documents} />
    </div>
  );
}
