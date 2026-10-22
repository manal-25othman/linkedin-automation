'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Archive, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  approveVersionAction,
  archiveVersionAction,
} from '../version-actions';

/**
 * أزرار الإصدار.
 *
 * والاعتماد **لا يُنفَّذ بضغطة واحدة بلا تأكيد**: هو الإجراء الذي يبدّل
 * مرجع الشركة كلها، وأثره يظهر في إجابات كل موظف بعده. فتأكيدٌ واحد
 * أرخص من استرجاعٍ لاحق.
 *
 * ولا تُعرض رسالة نجاح قبل عودة الإجراء: الحالة تتغيّر في القاعدة لا
 * في المتصفح، ورسالةُ نجاحٍ مبكّرة تُخبر المستخدم بما لم يحدث.
 */
export function VersionControls({
  documentId,
  canApprove,
  canArchive,
  isEffective,
}: {
  documentId: string;
  canApprove: boolean;
  canArchive: boolean;
  isEffective: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<'approve' | 'archive' | null>(null);

  function run(action: 'approve' | 'archive') {
    const form = new FormData();
    form.set('documentId', documentId);

    startTransition(async () => {
      const result =
        action === 'approve'
          ? await approveVersionAction(form)
          : await archiveVersionAction(form);

      setConfirming(null);
      if (result.ok) toast.success(result.message ?? 'تم.');
      else toast.error(result.message ?? 'تعذّر الإجراء.');
    });
  }

  if (confirming) {
    const isApprove = confirming === 'approve';
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {isApprove
            ? 'سيصبح هذا الإصدار مرجع إجابات الشركة. متأكد؟'
            : 'سيُؤرشف هذا الإصدار. متأكد؟'}
        </span>
        <Button
          size="sm"
          variant={isApprove ? 'default' : 'destructive'}
          disabled={pending}
          onClick={() => run(confirming)}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          تأكيد
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirming(null)}
        >
          إلغاء
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canApprove ? (
        <Button size="sm" onClick={() => setConfirming('approve')} disabled={pending}>
          <CheckCircle2 className="size-3.5" aria-hidden />
          اعتماد هذا الإصدار
        </Button>
      ) : null}

      {canArchive ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirming('archive')}
          disabled={pending}
        >
          <Archive className="size-3.5" aria-hidden />
          أرشفة
        </Button>
      ) : null}

      {isEffective ? (
        <span className="text-xs text-muted-foreground">
          هذا هو المرجع المعتمد حاليًا.
        </span>
      ) : null}
    </div>
  );
}
