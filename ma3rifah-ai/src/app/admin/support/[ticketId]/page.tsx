import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS } from '@/lib/config/support';
import { TicketThread } from '@/components/dashboard/ticket-thread';
import { TicketStatusControl } from '@/components/dashboard/ticket-status-control';
import { platformReplyAction } from '@/app/(dashboard)/support/actions';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'تذكرة — إدارة المنصة' };
export const dynamic = 'force-dynamic';

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  await requireSuperAdmin();
  const { ticketId } = await params;
  const admin = createAdminClient();

  const { data: ticket } = await admin
    .from('support_tickets')
    .select('id, subject, category, status, priority, company_id, created_by, created_at')
    .eq('id', ticketId)
    .maybeSingle();

  if (!ticket) notFound();

  const [{ data: company }, { data: author }, { data: messages }] = await Promise.all([
    admin.from('companies').select('name').eq('id', ticket.company_id).maybeSingle(),
    ticket.created_by
      ? admin.from('profiles').select('full_name, email').eq('id', ticket.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from('support_messages')
      .select('id, body, from_platform, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={ticket.subject}
        description={`${company?.name ?? '—'}${ticket.category ? ` · ${ticket.category}` : ''} · فُتحت ${formatDate(ticket.created_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{TICKET_PRIORITY_LABELS[ticket.priority]}</Badge>
            <Badge>{TICKET_STATUS_LABELS[ticket.status]}</Badge>
          </div>
        }
      />

      {author ? (
        <p className="text-sm text-muted-foreground">
          صاحب التذكرة: {author.full_name} — <span dir="ltr">{author.email}</span>
        </p>
      ) : null}

      <TicketStatusControl ticketId={ticket.id} status={ticket.status} />

      <TicketThread
        ticketId={ticket.id}
        messages={messages ?? []}
        action={platformReplyAction}
        platformView
      />
    </div>
  );
}
