'use client';

import { useState } from 'react';
import { Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/states';
import { CrudDialog } from '@/components/dashboard/crud-dialog';
import { formatNumber, formatRelativeTime } from '@/lib/utils';
import { updateKnowledgeGapAction } from './actions';
import type { GapStatus } from '@/types/database';

export interface GapRowData {
  id: string;
  question: string;
  timesAsked: number;
  departmentName: string | null;
  status: GapStatus;
  lastAskedAt: string;
  resolutionNote: string | null;
  linkedDocumentId: string | null;
  answerText: string | null;
}

const STATUS_META: Record<
  GapStatus,
  { label: string; variant: 'warning' | 'secondary' | 'success' | 'muted' }
> = {
  OPEN: { label: 'مفتوحة', variant: 'warning' },
  IN_REVIEW: { label: 'قيد المراجعة', variant: 'secondary' },
  RESOLVED: { label: 'معالَجة', variant: 'success' },
  DISMISSED: { label: 'متجاهَلة', variant: 'muted' },
};

export function GapsClient({
  gaps,
  documents,
  canManage,
}: {
  gaps: GapRowData[];
  documents: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<GapRowData | null>(null);

  if (gaps.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="لا توجد فجوات معرفة"
        description="كل الأسئلة التي طُرحت وجدت إجابة في قاعدة المعرفة. عندما يعجز المساعد عن الإجابة، سيظهر السؤال هنا تلقائيًا."
      />
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>السؤال</TableHead>
              <TableHead>التكرار</TableHead>
              <TableHead>القسم</TableHead>
              <TableHead>آخر مرة</TableHead>
              <TableHead>الحالة</TableHead>
              {canManage ? <TableHead className="w-24" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {gaps.map((gap) => (
              <TableRow key={gap.id}>
                <TableCell className="max-w-md">
                  <p className="text-sm leading-relaxed">{gap.question}</p>
                  {gap.resolutionNote ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      المعالجة: {gap.resolutionNote}
                    </p>
                  ) : null}
                </TableCell>

                <TableCell>
                  <Badge variant={gap.timesAsked >= 5 ? 'warning' : 'secondary'}>
                    {formatNumber(gap.timesAsked)} مرة
                  </Badge>
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  {gap.departmentName || '—'}
                </TableCell>

                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatRelativeTime(gap.lastAskedAt)}
                </TableCell>

                <TableCell>
                  <Badge variant={STATUS_META[gap.status].variant}>
                    {STATUS_META[gap.status].label}
                  </Badge>
                </TableCell>

                {canManage ? (
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => setEditing(gap)}>
                      معالجة
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <CrudDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="معالجة فجوة معرفة"
        description={editing?.question}
        submitLabel="حفظ"
        action={updateKnowledgeGapAction}
      >
        <input type="hidden" name="gapId" value={editing?.id ?? ''} />

        <div className="space-y-2">
          <Label htmlFor="status">الحالة</Label>
          <select
            id="status"
            name="status"
            defaultValue={editing?.status ?? 'IN_REVIEW'}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="OPEN">مفتوحة</option>
            <option value="IN_REVIEW">قيد المراجعة</option>
            <option value="RESOLVED">معالَجة</option>
            <option value="DISMISSED">متجاهَلة — سؤال خارج نطاق المعرفة</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="answerText">الإجابة المعتمدة</Label>
          <Textarea
            id="answerText"
            name="answerText"
            rows={5}
            maxLength={8000}
            defaultValue={editing?.answerText ?? ''}
            placeholder="اكتب الجواب كما تريد أن يصل موظفيك. مثال: تُقدَّم طلبات العمل الإضافي عبر مدير القسم قبل يومين على الأقل، وتُحتسب بواقع 150% من الأجر."
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            هذه الإجابة <b>تدخل قاعدة المعرفة فورًا</b>، فيجدها المساعد حين يسأل أي موظف السؤال
            نفسه — ولن يسمع «لم أجد معلومات» بعد اليوم. تُعرض له باعتبارها إجابة معتمدة من
            الإدارة، ويصله تنبيه بأن سؤاله صار له جواب.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="linkedDocumentId">أو استشهد بمستند موجود</Label>
          <select
            id="linkedDocumentId"
            name="linkedDocumentId"
            defaultValue={editing?.linkedDocumentId ?? ''}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">لا يوجد</option>
            {documents.map((document) => (
              <option key={document.id} value={document.id}>
                {document.name}
              </option>
            ))}
          </select>
          <p className="text-xs leading-relaxed text-muted-foreground">
            للتوثيق الداخلي فقط — ربط مستند لا يضيف شيئًا إلى قاعدة المعرفة، فالمستند مفهرس
            أصلًا. الإجابة المعتمدة أعلاه هي ما يسدّ الفجوة فعلًا.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="resolutionNote">ملاحظة المعالجة</Label>
          <Textarea
            id="resolutionNote"
            name="resolutionNote"
            rows={3}
            maxLength={2000}
            defaultValue={editing?.resolutionNote ?? ''}
            placeholder="ملاحظة إدارية داخلية لا يراها الموظفون. مثال: يُراجع الجواب بعد اعتماد اللائحة الجديدة."
          />
        </div>
      </CrudDialog>
    </>
  );
}
