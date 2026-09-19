'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, FileText, Plus, ScrollText, Sparkles, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import { CrudDialog } from '@/components/dashboard/crud-dialog';
import { EmptyState } from '@/components/shared/states';
import { formatRelativeTime } from '@/lib/utils';
import type { PolicyClarification, PolicyDraftCitation, PolicyDraftStatus } from '@/types/database';
import {
  approvePolicyDraftAction,
  discardPolicyDraftAction,
  generatePolicyDraftAction,
  savePolicyDraftAction,
  startPolicyDraftAction,
} from './actions';

export interface PolicyDraftView {
  id: string;
  title: string;
  topic: string;
  clarifications: PolicyClarification[];
  body: string;
  citations: PolicyDraftCitation[];
  status: PolicyDraftStatus;
  version: number;
  isPublished: boolean;
  approvedAt: string | null;
  updatedAt: string;
}

/**
 * الاستوديو في ثلاث خطوات ظاهرة: يُسأل المدير، ثم تُكتب المسوّدة، ثم
 * يحرّرها ويعتمدها. ولا خطوة رابعة مخفية — النشر هو الاعتماد نفسه.
 *
 * ولا محرّر نصوص غنيّ هنا عمدًا: المحرّرات مقابر مشاريع، ومربّع نصٍّ
 * يكفي لسياسة تُقرأ لا تُطبع.
 */
export function PolicyStudioClient({ drafts }: { drafts: PolicyDraftView[] }) {
  const [creating, setCreating] = useState(false);
  const [wizard, setWizard] = useState<PolicyDraftView | null>(null);
  const [editing, setEditing] = useState<PolicyDraftView | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: (data: FormData) => Promise<{ ok: boolean; message?: string }>, data: FormData) {
    startTransition(async () => {
      const result = await action(data);
      if (result.ok) {
        if (result.message) toast.success(result.message);
        setCreating(false);
        setWizard(null);
        setEditing(null);
      } else {
        toast.error(result.message ?? 'تعذّر إتمام العملية.');
      }
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden />
          سياسة جديدة
        </Button>
      </div>

      {drafts.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="لا مسوّدات بعد"
          description="ابدأ بسياسة واحدة — بدل السكن أو الإجازات مثلًا. تُسألك المنصة بضعة أسئلة ثم تكتب مسوّدة تحرّرها وتعتمدها."
        />
      ) : (
        <div className="grid gap-4">
          {drafts.map((draft) => (
            <Card key={draft.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{draft.title}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>الموضوع: {draft.topic}</span>
                    <span>النسخة {draft.version}</span>
                    <span>آخر تحديث {formatRelativeTime(draft.updatedAt)}</span>
                  </p>
                </div>

                {draft.isPublished ? (
                  <Badge variant="success">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    معتمدة ومنشورة
                  </Badge>
                ) : draft.body ? (
                  <Badge variant="warning">مسوّدة بانتظار مراجعتك</Badge>
                ) : (
                  <Badge variant="secondary">بانتظار أجوبتك</Badge>
                )}
              </div>

              {draft.body ? (
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap rounded-lg border-s-2 border-gold/50 bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
                  {draft.body}
                </p>
              ) : null}

              {draft.citations.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  مستندة إلى {draft.citations.length} مرجعًا نظاميًّا
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {draft.status === 'DRAFT' ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setWizard(draft)}>
                      <Sparkles className="size-4" aria-hidden />
                      {draft.body ? 'إعادة الكتابة' : 'أجب وأنشئ المسوّدة'}
                    </Button>
                    {draft.body ? (
                      <Button variant="outline" size="sm" onClick={() => setEditing(draft)}>
                        <FileText className="size-4" aria-hidden />
                        تحرير واعتماد
                      </Button>
                    ) : null}
                    <form
                      action={(data) => run(discardPolicyDraftAction, data)}
                      className="contents"
                    >
                      <input type="hidden" name="draftId" value={draft.id} />
                      <Button variant="ghost" size="sm" type="submit" disabled={pending}>
                        <Trash2 className="size-4" aria-hidden />
                        إهمال
                      </Button>
                    </form>
                  </>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ١ — سياسة جديدة */}
      <CrudDialog
        open={creating}
        onOpenChange={setCreating}
        title="سياسة جديدة"
        description="اكتب عنوان السياسة وموضوعها، وستسألك المنصة بضعة أسئلة قبل الكتابة."
        submitLabel="ابدأ"
        action={startPolicyDraftAction}
      >
        <div className="space-y-2">
          <Label htmlFor="title">عنوان السياسة *</Label>
          <Input id="title" name="title" required placeholder="سياسة بدل السكن" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="topic">الموضوع</Label>
          <Input id="topic" name="topic" placeholder="بدل السكن للموظفين" />
          <p className="text-xs text-muted-foreground">
            يُستعمل للبحث في وثائق شركتك وفي المراجع النظامية. اتركه فارغًا ليُؤخذ من العنوان.
          </p>
        </div>
      </CrudDialog>

      {/* ٢ — المعالج */}
      <CrudDialog
        open={wizard !== null}
        onOpenChange={(open) => !open && setWizard(null)}
        title="أسئلة قبل الكتابة"
        description="السياسة بلا نطاق ولا مبالغ ولا استثناءات نصٌّ عام لا يصلح لشركة بعينها."
        submitLabel="اكتب المسوّدة"
        action={generatePolicyDraftAction}
      >
        {wizard ? (
          <>
            <input type="hidden" name="draftId" value={wizard.id} />
            {wizard.clarifications.map((item, index) => (
              <div key={index} className="space-y-2">
                <Label htmlFor={`answer-${index}`}>{item.question}</Label>
                <Textarea
                  id={`answer-${index}`}
                  name={`answer-${index}`}
                  rows={2}
                  defaultValue={item.answer}
                  placeholder="اتركه فارغًا إن لم ينطبق"
                />
              </div>
            ))}
          </>
        ) : null}
      </CrudDialog>

      {/* ٣ — التحرير والاعتماد */}
      <CrudDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="تحرير المسوّدة"
        description="احفظ تعديلاتك أولًا — كل حفظ نسخة مؤرّخة. والاعتماد يُدخل النصّ قاعدة المعرفة فيجيب موظفيك."
        submitLabel="حفظ التعديل"
        action={savePolicyDraftAction}
      >
        {editing ? (
          <>
            <input type="hidden" name="draftId" value={editing.id} />
            <div className="space-y-2">
              <Label htmlFor="body">نصّ السياسة</Label>
              <Textarea id="body" name="body" rows={16} defaultValue={editing.body} required />
            </div>

            {editing.citations.length > 0 ? (
              <div className="space-y-2">
                <Label>المراجع النظامية المستنَد إليها</Label>
                <ul className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  {editing.citations.map((citation, index) => (
                    <li key={index}>
                      • {citation.authority}
                      {citation.referenceCode ? ` — ${citation.referenceCode}` : ''} ·{' '}
                      {citation.documentName}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="rounded-lg bg-warning/10 p-3 text-xs leading-relaxed text-muted-foreground">
                ⚠️ لم تُستعمل مراجع نظامية في هذه المسوّدة. راجع أي جملة تنسب حكمًا إلى نظام قبل الاعتماد.
              </p>
            )}
          </>
        ) : null}
      </CrudDialog>

      {/* الاعتماد خارج نموذج التحرير: زرّ واحد لا يُضغط سهوًا مع الحفظ */}
      {editing && editing.body ? (
        <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-fit">
          <form action={(data) => run(approvePolicyDraftAction, data)}>
            <input type="hidden" name="draftId" value={editing.id} />
            <Button type="submit" disabled={pending} className="shadow-lg">
              <CheckCircle2 className="size-4" aria-hidden />
              اعتماد ونشر في قاعدة المعرفة
            </Button>
          </form>
        </div>
      ) : null}
    </>
  );
}
