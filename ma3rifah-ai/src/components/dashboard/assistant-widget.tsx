'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ChatBubblePanel } from '@/components/shared/chat-bubble-panel';
import { askAction } from '@/app/(dashboard)/assistant/actions';

/**
 * مساعد الشركة كنافذة عائمة داخل لوحة التحكم.
 *
 * يستدعي `askAction` نفسه الذي تستدعيه صفحة /assistant، فيمرّ بالمسار
 * الكامل: التحقق من الجلسة، الحصة، الاسترجاع الخاضع للصلاحيات داخل
 * قاعدة البيانات. لا يوجد هنا مسار مختصر يتجاوز أيًّا من ذلك.
 *
 * المحادثة تُحفظ كمحادثة عادية، فتظهر لاحقًا في صفحة المحادثات.
 */
export function AssistantWidget({ companyName }: { companyName: string }) {
  const conversationId = useRef<string | null>(null);

  return (
    <ChatBubblePanel
      title="مساعد الشركة"
      subtitle={companyName}
      greeting="اسألني عن سياسات شركتك وإجراءاتها. سأجيب من مستنداتها وأذكر لك المصدر."
      launcherLabel="افتح مساعد الشركة"
      placeholder="اسأل عن سياسة أو إجراء…"
      footer={
        <>
          للمحادثة الكاملة مع المصادر:{' '}
          <Link href="/assistant" className="font-medium text-primary underline">
            افتح المساعد
          </Link>
        </>
      }
      onSend={async (question) => {
        const result = await askAction({
          question,
          conversationId: conversationId.current,
        });

        if (!result.ok || !result.data) {
          return {
            content: result.message ?? 'تعذّر الرد الآن.',
            tone: 'warning' as const,
          };
        }

        conversationId.current = result.data.conversationId;

        const sources = result.data.sources;
        return {
          content: result.data.answer,
          tone: result.data.isUnanswered ? ('warning' as const) : ('default' as const),
          extra:
            sources.length > 0 ? (
              <div className="mt-3 border-t border-black/10 pt-2">
                <p className="mb-1 text-[11px] font-semibold text-muted-foreground">المصادر</p>
                <ul className="space-y-1">
                  {sources.slice(0, 3).map((source) => (
                    <li key={source.documentId + (source.pageNumber ?? '')} className="text-[11px] leading-5">
                      {source.documentName}
                      {source.pageNumber ? ` — صفحة ${source.pageNumber}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
        };
      }}
    />
  );
}
