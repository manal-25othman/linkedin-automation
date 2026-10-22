import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * تنبيه المراجعة الإداري.
 *
 * ثلاث حالات تُجمع هنا لأن جوابها واحد — «راجع واعتمد»:
 *
 *   • وثيقة رُحّلت من قبل نظام الإصدارات: تخدم ولم يُقرَّر اعتمادها.
 *   • وثيقة لا مرجع لها إطلاقًا: لا تُجيب، والمدير يظنّها تعمل.
 *   • إصدار جاهز ينتظر الاعتماد.
 *
 * والثانية أخطرها: الوثيقة مرفوعة والفهرسة اكتملت، والمساعد يقول «لم
 * أجد» عن محتوى موجود. ولولا هذه البطاقة لبقي السبب غامضًا.
 *
 * وتظهر لمدير الشركة وحده (الدالّة نفسها تحرس ذلك)، وتختفي عند
 * الفراغ — فبطاقةٌ خاوية تشغل مساحة ولا تقول شيئًا.
 */

const REASON_LABELS: Record<string, { label: string; hint: string }> = {
  NO_REFERENCE: {
    label: 'بلا مرجع',
    hint: 'لا تُستخدم في الإجابات — اعتمد أحد إصداراتها',
  },
  MIGRATED_UNREVIEWED: {
    label: 'بانتظار المراجعة',
    hint: 'تُستخدم حاليًا ولم يُسجَّل قرار اعتماد لها',
  },
  PENDING_VERSION: {
    label: 'إصدار جاهز',
    hint: 'إصدار أحدث اكتملت معالجته وينتظر الاعتماد',
  },
};

export interface AwaitingReviewItem {
  family_id: string;
  title: string;
  reason: string;
}

export function AwaitingReviewCard({ items }: { items: AwaitingReviewItem[] }) {
  if (items.length === 0) return null;

  const shown = items.slice(0, 6);

  return (
    <Card className="border-gold/30 bg-gold/5">
      <CardContent className="space-y-3 p-6">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-gold" aria-hidden />
          <h2 className="text-sm font-semibold">
            {items.length} وثيقة تحتاج مراجعتك
          </h2>
        </div>

        <ul className="space-y-2">
          {shown.map((item) => {
            const reason = REASON_LABELS[item.reason] ?? {
              label: 'تحتاج مراجعة',
              hint: '',
            };
            return (
              <li
                key={item.family_id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <Link
                  href={`/documents/${item.family_id}`}
                  className="truncate font-medium hover:underline"
                >
                  {item.title}
                </Link>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{reason.hint}</span>
                  <Badge variant="secondary">{reason.label}</Badge>
                </span>
              </li>
            );
          })}
        </ul>

        {items.length > shown.length ? (
          <p className="text-xs text-muted-foreground">
            و{items.length - shown.length} غيرها.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
