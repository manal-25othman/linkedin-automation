import type { Metadata } from 'next';
import { AlertTriangle, FileStack } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/auth/rbac';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/states';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UploadDialog } from '@/components/dashboard/documents/upload-dialog';
import { DocumentRowActions } from '@/components/dashboard/documents/document-actions';
import {
  DocumentStatusBadge,
  VISIBILITY_LABELS,
} from '@/components/dashboard/documents/document-status';
import { formatBytes, formatNumber, formatRelativeTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'المستندات' };
export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const { profile } = await requirePermission('documents.view');
  const supabase = await createClient();
  const canManage = can(profile.role, 'documents.manage');

  const [documentsResult, categoriesResult, departmentsResult] = await Promise.all([
    supabase
      .from('documents')
      .select(
        'id, name, status, error_message, file_type, file_size_bytes, chunk_count, page_count, visibility, allowed_department_ids, category_id, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('knowledge_categories').select('id, name').order('sort_order'),
    supabase.from('departments').select('id, name').order('name'),
  ]);

  const documents = documentsResult.data ?? [];
  const categories = categoriesResult.data ?? [];
  const departments = departmentsResult.data ?? [];

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const failedCount = documents.filter((document) => document.status === 'FAILED').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="المستندات"
        description="ارفع مستندات شركتك لتصبح جزءًا من قاعدة المعرفة التي يجيب منها المساعد."
        actions={
          canManage ? (
            <UploadDialog categories={categories} departments={departments} />
          ) : null
        }
      />

      {failedCount > 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm text-destructive">
            {formatNumber(failedCount)} مستند تعذّرت معالجته. افتح قائمة الخيارات لكل مستند
            وأعد المحاولة، أو تحقّق من سلامة الملف.
          </p>
        </div>
      ) : null}

      {documents.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="لا توجد مستندات بعد"
          description={
            canManage
              ? 'ابدأ برفع سياسة أو دليل تشغيل. سيُفهرس المستند خلال أقل من دقيقة ويصبح قابلًا للسؤال عنه.'
              : 'لم يُضِف مدير الشركة أي مستندات متاحة لك بعد.'
          }
          action={
            canManage ? (
              <UploadDialog categories={categories} departments={departments} />
            ) : null
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المستند</TableHead>
                <TableHead>التصنيف</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الوصول</TableHead>
                <TableHead>المقاطع</TableHead>
                <TableHead>الحجم</TableHead>
                <TableHead>أُضيف</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell className="max-w-[22rem]">
                    <p className="truncate font-medium">{document.name}</p>
                    {document.status === 'FAILED' && document.error_message ? (
                      <p className="mt-1 text-xs leading-relaxed text-destructive">
                        {document.error_message}
                      </p>
                    ) : null}
                  </TableCell>

                  <TableCell>
                    {document.category_id ? (
                      <Badge variant="secondary">
                        {categoryNames.get(document.category_id) ?? '—'}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <DocumentStatusBadge status={document.status} />
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {VISIBILITY_LABELS[document.visibility]}
                  </TableCell>

                  <TableCell className="tabular-nums text-sm text-muted-foreground">
                    {document.status === 'READY' ? formatNumber(document.chunk_count) : '—'}
                  </TableCell>

                  <TableCell className="tabular-nums text-sm text-muted-foreground">
                    {formatBytes(document.file_size_bytes)}
                  </TableCell>

                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatRelativeTime(document.created_at)}
                  </TableCell>

                  <TableCell>
                    <DocumentRowActions
                      documentId={document.id}
                      documentName={document.name}
                      status={document.status}
                      canManage={canManage}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
