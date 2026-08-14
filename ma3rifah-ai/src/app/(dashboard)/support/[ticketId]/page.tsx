import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireCompanySession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS } from '@/lib/config/support';
import { TicketThread } from '@/components/dashboard/ticket-thread';
import { replyToTicketAction } from '../actions';

export const metadata: Metadata = { title: 'تذكرة دعم' };
export const dynamic = 'force-dynamic';

export default async function TicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  await requireCompanySession();
  const { ticketId } = await params;
  const supabase = await createClient();

  // تتكفّل RLS بالمنع عبر الشركات — الغياب هنا يعني «ليست لك»
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, subject, category, status, priority, created_at')
    .eq('id', ticketId)
    .maybeSingle();

  if (!ticket) notFound();

  const { data: messages } = await supabase
    .from('support_messages')
    .select('id, body, from_platform, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  const isClosed = ticket.status === 'CLOSED';

  return (
    <div className="space-y-6">
      <PageHeader
        title={ticket.subject}
        description={ticket.category ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{TICKET_PRIORITY_LABELS[ticket.priority]}</Badge>
            <Badge>{TICKET_STATUS_LABELS[ticket.status]}</Badge>
          </div>
        }
      />

      <TicketThread
        ticketId={ticket.id}
        messages={messages ?? []}
        action={replyToTicketAction}
        disabled={isClosed}
        disabledNote="التذكرة مغلقة. افتح تذكرة جديدة إن عادت المشكلة."
      />
    </div>
  );
}
