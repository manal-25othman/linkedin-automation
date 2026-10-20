'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { BookOpen, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { CrudDialog } from '@/components/dashboard/crud-dialog';
import { EmptyState } from '@/components/shared/states';
import { formatBytes, formatRelativeTime } from '@/lib/utils';
import type { DocumentStatus } from '@/types/database';
import {
  createReferenceUploadTicketAction,
  deleteReferenceDocumentAction,
  finalizeReferenceUploadAction,
  uploadReferenceDocumentAction,
} from './actions';

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
  const [hasFile, setHasFile] = useState(false);

  /*
   * مساران في نموذج واحد.
   *
   * الملف يحتاج ثلاث خطوات (تذكرة ← رفع من المتصفح ← إنهاء) لأن حمولة
   * الإجراء الخادمي محدودة ولا تحتمل ملفًا كاملًا. واللصق يحتاج خطوة.
   * والمستخدم لا يُطالَب بمعرفة الفرق.
   */
  async function submitReference(formData: FormData) {
    const file = formData.get('file');

    if (!(file instanceof File) || file.size === 0) {
      const body = String(formData.get('body') ?? '').trim();
      if (!body) {
        return { ok: false, message: 'ارفع ملفًا أو الصق النصّ.' };
      }
      return uploadReferenceDocumentAction(formData);
    }

    const ticket = await createReferenceUploadTicketAction({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    if (!ticket.ok || !ticket.ticket) {
      return { ok: false, message: ticket.message ?? 'تعذّر تجهيز الرفع.' };
    }

    const supabase = createClient();
    const { error } = await supabase.storage
      .from('reference-library')
      .uploadToSignedUrl(ticket.ticket.path, ticket.ticket.token, file, {
        contentType: file.type || 'application/pdf',
      });

    if (error) {
      return { ok: false, message: 'تعذّر رفع الملف. تحقّق من اتصالك.' };
    }

    const finalize = new FormData();
    for (const key of ['name', 'authority', 'referenceCode', 'sourceUrl', 'description']) {
      finalize.set(key, String(formData.get(key) ?? ''));
    }
    finalize.set('storagePath', ticket.ticket.path);
    finalize.set('fileName', file.name);
    finalize.set('fileType', file.type);

    return finalizeReferenceUploadAction(finalize);
  }
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
        description="ارفع ملف النظام من مصدره الرسمي، أو الصق نصّه. لا تُعِد صياغته — النصّ النظامي المُعاد صياغته يصير سياسةَ شركةٍ معتمدة."
        submitLabel="رفع وفهرسة"
        action={submitReference}
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
          <Label htmlFor="file">ملف النظام (PDF أو Word)</Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md"
            onChange={(event) => setHasFile(!!event.currentTarget.files?.length)}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            يمرّ الملف بخطّ المعالجة نفسه الذي تمرّ به مستندات الشركات: إصلاح PDF
            العربي، والقراءة الضوئية للممسوح، وقياس جودة الاستخراج. والملف الفاسد
            يُرفض ولا يُخزَّن.
          </p>
        </div>

        {!hasFile ? (
          <div className="space-y-2">
            <Label htmlFor="body">أو الصق النصّ</Label>
            <Textarea
              id="body"
              name="body"
              rows={10}
              placeholder="للمقاطع القصيرة — مادة واحدة مثلًا…"
            />
          </div>
        ) : null}
      </CrudDialog>
    </>
  );
}
