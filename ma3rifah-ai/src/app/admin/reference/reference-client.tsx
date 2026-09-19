'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { BookOpen, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import { CrudDialog } from '@/components/dashboard/crud-dialog';
import { EmptyState } from '@/components/shared/states';
import { formatBytes, formatRelativeTime } from '@/lib/utils';
import type { DocumentStatus } from '@/types/database';
import { deleteReferenceDocumentAction, uploadReferenceDocumentAction } from './actions';

export interface ReferenceDocumentView {
  id: string;
  name: string;
  authority: string;
  referenceCode: string | null;
  sourceUrl: string | null;
  status: DocumentStatus;
  sizeBytes: number;
  createdAt: string;
}

const STATUS_LABEL: Record<DocumentStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  READY: { label: 'منشورة', variant: 'success' },
  PROCESSING: { label: 'تُفهرس', variant: 'warning' },
  FAILED: { label: 'فشلت الفهرسة', variant: 'destructive' },
  ARCHIVED: { label: 'مؤرشفة', variant: 'secondary' },
};

export function ReferenceClient({ documents }: { documents: ReferenceDocumentView[] }) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  // الحذف خارج `CrudDialog`، فيُغلَّف هنا: نموذج HTML يشترط إجراءً
  // لا يُعيد قيمة، والإجراء يُعيد نتيجة تُعرض للمالكة.
  function handleDelete(data: FormData) {
    startTransition(async () => {
      const result = await deleteReferenceDocumentAction(data);
      if (result.ok) toast.success(result.message ?? 'حُذفت الوثيقة.');
      else toast.error(result.message ?? 'تعذّر الحذف.');
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden />
          وثيقة مرجعية
        </Button>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="المكتبة فارغة"
          description="ارفع نصوص الأنظمة من مصادرها الرسمية. ابدأ بنظام العمل — يكفي وحده للنسخة الأولى من استوديو السياسات."
        />
      ) : (
        <div className="grid gap-3">
          {documents.map((doc) => {
            const status = STATUS_LABEL[doc.status];
            return (
              <Card key={doc.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{doc.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{doc.authority}</span>
                    {doc.referenceCode ? <span>{doc.referenceCode}</span> : null}
                    <span>{formatBytes(doc.sizeBytes)}</span>
                    <span>{formatRelativeTime(doc.createdAt)}</span>
                    {doc.sourceUrl ? (
                      <a
                        href={doc.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 underline"
                      >
                        المصدر
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : null}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <form action={handleDelete}>
                    <input type="hidden" name="documentId" value={doc.id} />
                    <Button variant="ghost" size="sm" type="submit" disabled={pending}>
                      <Trash2 className="size-4" aria-hidden />
                      حذف
                    </Button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CrudDialog
        open={adding}
        onOpenChange={setAdding}
        title="وثيقة مرجعية"
        description="الصق النصّ من مصدره الرسمي كما هو. لا تُعِد صياغته — النصّ النظامي المُعاد صياغته يصير سياسةَ شركةٍ معتمدة."
        submitLabel="رفع وفهرسة"
        action={uploadReferenceDocumentAction}
      >
        <div className="space-y-2">
          <Label htmlFor="name">اسم الوثيقة *</Label>
          <Input id="name" name="name" required placeholder="نظام العمل — الباب السادس" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="authority">الجهة المُصدِرة *</Label>
          <Input
            id="authority"
            name="authority"
            required
            placeholder="وزارة الموارد البشرية والتنمية الاجتماعية"
          />
          <p className="text-xs text-muted-foreground">تظهر في كل استشهاد داخل المسوّدات.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="referenceCode">رقم المرجع</Label>
          <Input id="referenceCode" name="referenceCode" placeholder="المواد ٧٤–٨٧" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sourceUrl">رابط المصدر</Label>
          <Input id="sourceUrl" name="sourceUrl" type="url" placeholder="https://laws.boe.gov.sa/..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="body">النصّ *</Label>
          <Textarea id="body" name="body" rows={12} required placeholder="الصق النصّ الكامل هنا…" />
        </div>
      </CrudDialog>
    </>
  );
}
