import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireCompanySession } from '@/lib/auth/session';
import { AssistantShell } from '../assistant-shell';

export const metadata: Metadata = { title: 'المساعد الذكي' };
export const dynamic = 'force-dynamic';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  await requireCompanySession();
  const supabase = await createClient();

  // RLS تضمن أن محادثات المستخدمين الآخرين غير مرئية أصلًا
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conversation) notFound();

  return <AssistantShell conversationId={conversationId} />;
}
