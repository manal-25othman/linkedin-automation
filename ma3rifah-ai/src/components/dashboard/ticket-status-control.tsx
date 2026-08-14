'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateTicketStatusAction } from '@/app/(dashboard)/support/actions';
import { TICKET_STATUS_LABELS } from '@/lib/config/support';
import { Button } from '@/components/ui/button';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

/** تغيير حالة التذكرة — تفرض قاعدة البيانات أن المنفّذ مالك المنصة */
export function TicketStatusControl({
  ticketId,
  status,
}: {
  ticketId: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function setStatus(next: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('ticketId', ticketId);
      formData.set('status', next);
      await updateTicketStatusAction(formData);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
      <span className="text-sm text-muted-foreground">الحالة:</span>
      {STATUSES.map((value) => (
        <Button
          key={value}
          size="sm"
          variant={value === status ? 'default' : 'outline'}
          disabled={isPending || value === status}
          onClick={() => setStatus(value)}
        >
          {TICKET_STATUS_LABELS[value]}
        </Button>
      ))}
    </div>
  );
}
