'use client';

import { usePathname } from 'next/navigation';
import { ChatBubblePanel } from '@/components/shared/chat-bubble-panel';
import { SITE_SUGGESTED_QUESTIONS } from '@/lib/ai/site-knowledge';

/**
 * محادثة زوّار الموقع.
 *
 * تخاطب مسارًا عامًا لا يمس بيانات أي شركة — مصدر إجاباته نص ثابت عن
 * المنصة. لا تُعرض داخل لوحة التحكم؛ هناك مساعد الشركة الحقيقي.
 */
export function SiteChatWidget() {
  const pathname = usePathname();

  return (
    <ChatBubblePanel
      title="مساعد معرفة AI"
      subtitle="اسأل عن المنصة والباقات"
      greeting="أهلًا بك. أنا مساعد الموقع، أجيب عن أسئلتك حول منصة معرفة AI وكيف تعمل وباقاتها. كيف أساعدك؟"
      suggestions={SITE_SUGGESTED_QUESTIONS}
      launcherLabel="افتح محادثة المساعد"
      placeholder="اسأل عن المنصة…"
      footer="هذا المساعد يجيب عن المنصة فقط ولا يطّلع على بيانات أي شركة."
      onSend={async (question) => {
        const response = await fetch('/api/site-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, path: pathname }),
        });

        const payload = (await response.json()) as {
          answer?: string;
          isUnanswered?: boolean;
          error?: string;
        };

        if (!response.ok) {
          return {
            content: payload.error ?? 'تعذّر الرد الآن. حاول مرة أخرى.',
            tone: 'warning' as const,
          };
        }

        return {
          content: payload.answer ?? '',
          tone: payload.isUnanswered ? ('warning' as const) : ('default' as const),
        };
      }}
    />
  );
}
