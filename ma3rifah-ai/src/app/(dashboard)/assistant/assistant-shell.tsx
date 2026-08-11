import { requireCompanySession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { isAiConfigured } from '@/lib/ai/claude';
import { Chat, type ChatMessage } from '@/components/dashboard/assistant/chat';
import { ConversationList, type ConversationSummary } from './conversation-list';
import type { AnswerSource } from '@/lib/ai/chat-service';

/**
 * الهيكل المشترك بين /assistant و /assistant/[conversationId].
 * يجلب قائمة المحادثات ورسائل المحادثة النشطة عبر جلسة المستخدم،
 * فتتكفّل RLS بمنع الوصول إلى محادثات الآخرين.
 */
export async function AssistantShell({
  conversationId,
}: {
  conversationId: string | null;
}) {
  await requireCompanySession();
  const supabase = await createClient();

  const [conversationsResult, readyDocumentsResult] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, title, last_message_at')
      .eq('is_archived', false)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(50),
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'READY'),
  ]);

  const conversations: ConversationSummary[] = (conversationsResult.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    lastMessageAt: row.last_message_at,
  }));

  let messages: ChatMessage[] = [];

  if (conversationId) {
    const { data: rows } = await supabase
      .from('messages')
      .select('id, role, content, feedback, answer_status')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    const assistantIds = (rows ?? [])
      .filter((row) => row.role === 'ASSISTANT')
      .map((row) => row.id);

    const sourcesByMessage = new Map<string, AnswerSource[]>();

    if (assistantIds.length > 0) {
      const { data: sourceRows } = await supabase
        .from('message_sources')
        .select('message_id, document_id, document_name, page_number, section_title, similarity, excerpt')
        .in('message_id', assistantIds)
        .order('similarity', { ascending: false });

      for (const source of sourceRows ?? []) {
        const list = sourcesByMessage.get(source.message_id) ?? [];
        list.push({
          documentId: source.document_id ?? '',
          documentName: source.document_name,
          pageNumber: source.page_number,
          sectionTitle: source.section_title,
          similarity: source.similarity ?? 0,
          excerpt: source.excerpt ?? '',
        });
        sourcesByMessage.set(source.message_id, list);
      }
    }

    messages = (rows ?? []).map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      feedback: row.feedback,
      isUnanswered: row.answer_status === 'UNANSWERED',
      sources: sourcesByMessage.get(row.id) ?? [],
    }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside className="hidden rounded-xl border bg-card lg:block">
        <ConversationList conversations={conversations} activeId={conversationId} />
      </aside>

      <div className="min-w-0">
        <Chat
          key={conversationId ?? 'new'}
          conversationId={conversationId}
          initialMessages={messages}
          isAiConfigured={isAiConfigured()}
          hasDocuments={(readyDocumentsResult.count ?? 0) > 0}
        />
      </div>
    </div>
  );
}
