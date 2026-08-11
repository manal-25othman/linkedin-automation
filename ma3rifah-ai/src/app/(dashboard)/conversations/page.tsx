import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, MessagesSquare } from 'lucide-react';
import { requireCompanySession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/states';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatNumber, formatRelativeTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'المحادثات' };
export const dynamic = 'force-dynamic';

export default async function ConversationsPage() {
  await requireCompanySession();
  const supabase = await createClient();

  // RLS تقصر النتائج على محادثات المستخدم نفسه
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, title, message_count, last_message_at, created_at')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100);

  const rows = conversations ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="المحادثات"
        description="سجل محادثاتك مع المساعد. محادثاتك خاصة بك ولا يطّلع عليها غيرك."
        actions={
          <Button asChild>
            <Link href="/assistant">محادثة جديدة</Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="لا توجد محادثات بعد"
          description="ابدأ محادثة مع المساعد واسأل عن أي سياسة أو إجراء في شركتك."
          action={
            <Button asChild>
              <Link href="/assistant">اسأل المساعد</Link>
            </Button>
          }
        />
      ) : (
        <Card className="divide-y overflow-hidden">
          {rows.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/assistant/${conversation.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{conversation.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="muted">
                    {formatNumber(conversation.message_count)} رسالة
                  </Badge>
                  <span>آخر نشاط {formatRelativeTime(conversation.last_message_at)}</span>
                </div>
              </div>
              <ArrowLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
