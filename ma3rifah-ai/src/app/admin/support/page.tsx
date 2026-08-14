import type { Metadata } from 'next';
import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS } from '@/lib/config/support';
import { formatRelativeTime, truncate } from '@/lib/utils';

export const metadata: Metadata = { title: 'الدعم — إدارة المنصة' };
export const dynamic = 'force-dynamic';

const STATUS_VARIANT: Record<string, 'warning' | 'secondary' | 'success' | 'muted'> = {
  OPEN: 'warning',
  IN_PROGRESS: 'secondary',
  RESOLVED: 'success',
  CLOSED: 'muted',
};

export default async function AdminSupportPage() {
  await requireSuperAdmin();

  // مالك المنصة يرى كل التذاكر — بعد تحقق صريح أعلاه
  const admin = createAdminClient();
  const { data: tickets } = await admin
    .from('support_tickets')
    .select('id, subject, status, priority, awaiting_platform, last_reply_at, company_id')
    .order('last_reply_at', { ascending: false })
    .limit(200);

  const companyIds = [...new Set((tickets ?? []).map((ticket) => ticket.company_id))];
  const { data: companies } = companyIds.length
    ? await admin.from('companies').select('id, name').in('id', companyIds)
    : { data: [] };

  const nameById = new Map((companies ?? []).map((company) => [company.id, company.name]));

  const waiting = (tickets ?? []).filter((t) => t.awaiting_platform && t.status !== 'CLOSED');
  const open = (tickets ?? []).filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');

  return (
    <div className="space-y-6">
      <PageHeader
        title="الدعم الفني"
        description="كل بلاغات العملاء في مكان واحد. ما ينتظر ردّك أولًا."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="ينتظر ردّك"
          value={waiting.length}
          icon={LifeBuoy}
          tone={waiting.length > 0 ? 'warning' : 'success'}
        />
        <StatCard label="مفتوحة" value={open.length} icon={LifeBuoy} />
        <StatCard label="الإجمالي" value={tickets?.length ?? 0} icon={LifeBuoy} />
      </div>

      {!tickets?.length ? (
        <EmptyState icon={LifeBuoy} title="لا توجد تذاكر" description="لم يفتح أي عميل تذكرة بعد." />
      ) : (
        <ul className="space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/admin/support/${ticket.id}`}
                className="block rounded-xl border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{truncate(ticket.subject, 90)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {nameById.get(ticket.company_id) ?? '—'} · آخر تحديث{' '}
                      {formatRelativeTime(ticket.last_reply_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {ticket.priority === 'URGENT' || ticket.priority === 'HIGH' ? (
                      <Badge variant="destructive">{TICKET_PRIORITY_LABELS[ticket.priority]}</Badge>
                    ) : null}
                    {ticket.awaiting_platform && ticket.status !== 'CLOSED' ? (
                      <Badge variant="warning">ينتظر ردّك</Badge>
                    ) : null}
                    <Badge variant={STATUS_VARIANT[ticket.status]}>
                      {TICKET_STATUS_LABELS[ticket.status]}
                    </Badge>
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
