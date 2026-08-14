import type { Metadata } from 'next';
import Link from 'next/link';
import { LifeBuoy, MessageSquare } from 'lucide-react';
import { requireCompanySession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS } from '@/lib/config/support';
import { formatRelativeTime, truncate } from '@/lib/utils';
import { NewTicketButton } from './new-ticket';

export const metadata: Metadata = { title: 'الدعم الفني' };
export const dynamic = 'force-dynamic';

const STATUS_VARIANT: Record<string, 'warning' | 'secondary' | 'success' | 'muted'> = {
  OPEN: 'warning',
  IN_PROGRESS: 'secondary',
  RESOLVED: 'success',
  CLOSED: 'muted',
};

export default async function SupportPage() {
  await requireCompanySession();
  const supabase = await createClient();

  // تتكفّل RLS بقصر النتائج على شركة المستخدم
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, subject, category, status, priority, last_reply_at, awaiting_platform, created_at')
    .order('last_reply_at', { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="الدعم الفني"
        description="واجهتك المباشرة مع فريق المنصة. افتح تذكرة وسنتابعها حتى تُحلّ."
        actions={<NewTicketButton />}
      />

      {!tickets?.length ? (
        <EmptyState
          icon={LifeBuoy}
          title="لا توجد تذاكر"
          description="واجهت مشكلة أو لديك اقتراح؟ افتح تذكرة وسنردّ عليك."
        />
      ) : (
        <ul className="space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/support/${ticket.id}`}
                className="block rounded-xl border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{truncate(ticket.subject, 90)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ticket.category ? `${ticket.category} · ` : ''}
                      آخر تحديث {formatRelativeTime(ticket.last_reply_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {ticket.priority !== 'NORMAL' ? (
                      <Badge variant="outline">{TICKET_PRIORITY_LABELS[ticket.priority]}</Badge>
                    ) : null}
                    <Badge variant={STATUS_VARIANT[ticket.status]}>
                      {TICKET_STATUS_LABELS[ticket.status]}
                    </Badge>
                    {!ticket.awaiting_platform ? (
                      <Badge variant="default">
                        <MessageSquare className="size-3" aria-hidden />
                        ردّ جديد
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
