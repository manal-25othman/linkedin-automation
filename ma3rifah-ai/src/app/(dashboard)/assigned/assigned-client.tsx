'use client';

import { useState } from 'react';
import { CheckCircle2, Clock, PenLine } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { CrudDialog } from '@/components/dashboard/crud-dialog';
import { formatNumber, formatRelativeTime } from '@/lib/utils';
import { submitExpertAnswerAction } from './actions';

export interface AssignedGap {
  id: string;
  question: string;
  timesAsked: number;
  lastAskedAt: string;
  expertAnswer: string | null;
  expertAnsweredAt: string | null;
  /** اعتمده المدير ودخل قاعدة المعرفة */
  isPublished: boolean;
}

export function AssignedClient({ gaps }: { gaps: AssignedGap[] }) {
  const [editing, setEditing] = useState<AssignedGap | null>(null);

  return (
    <>
      <div className="grid gap-4">
        {gaps.map((gap) => (
          <Card key={gap.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-relaxed">{gap.question}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>سُئل {formatNumber(gap.timesAsked)} مرة</span>
                  <span>آخر مرة {formatRelativeTime(gap.lastAskedAt)}</span>
                </p>
              </div>

              {/* الحالة الثلاثية: لم تُجب · بانتظار الاعتماد · منشورة */}
              {gap.isPublished ? (
                <Badge variant="success">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  اعتُمد ونُشر
                </Badge>
              ) : gap.expertAnsweredAt ? (
                <Badge variant="secondary">
                  <Clock className="size-3.5" aria-hidden />
                  بانتظار اعتماد المدير
                </Badge>
              ) : (
                <Badge variant="warning">بانتظار جوابك</Badge>
              )}
            </div>

            {gap.expertAnswer ? (
              <p className="mt-3 rounded-lg border-s-2 border-primary/40 bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
                {gap.expertAnswer}
              </p>
            ) : null}

            {/* الجواب المنشور لا يُعدَّل من هنا: صار مستندًا في قاعدة
                المعرفة، وتعديله قرار إداري يمرّ بالمدير */}
            {gap.isPublished ? null : (
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={() => setEditing(gap)}>
                  <PenLine className="size-4" aria-hidden />
                  {gap.expertAnswer ? 'تعديل جوابي' : 'اكتب الجواب'}
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <CrudDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="اكتب الجواب من معرفتك"
        description={editing?.question}
        submitLabel="أرسل إلى المدير"
        action={submitExpertAnswerAction}
      >
        <input type="hidden" name="gapId" value={editing?.id ?? ''} />

        <div className="space-y-2">
          <Label htmlFor="answer">الجواب</Label>
          <Textarea
            id="answer"
            name="answer"
            rows={6}
            maxLength={8000}
            key={editing?.id ?? 'blank'}
            defaultValue={editing?.expertAnswer ?? ''}
            placeholder="اكتب الجواب كما تريد أن يصل زملاءك. مثال: عهدة السلامة تُراجَع كل ستة أشهر، ويوقّع مسؤول القسم على محضر المراجعة."
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            جوابك يذهب إلى مدير الشركة أولًا. <b>لن يراه أي موظف قبل أن يعتمده</b>، وعند
            اعتماده يدخل قاعدة المعرفة ويصل تنبيه إلى كل من سأل هذا السؤال.
          </p>
        </div>
      </CrudDialog>
    </>
  );
}
