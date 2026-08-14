'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

export interface TicketMessage {
  id: string;
  body: string;
  from_platform: boolean;
  created_at: string;
}

/**
 * خيط المحادثة في تذكرة الدعم.
 *
 * جهة الرسالة تُقرأ من قاعدة البيانات لا من الواجهة: سياسة الإدراج تمنع
 * عميلًا من وسم رسالته بأنها «من المنصة»، فما يظهر هنا رسميًا رسميٌّ فعلًا.
 */
export function TicketThread({
  ticketId,
  messages,
  action,
  disabled = false,
  disabledNote,
  platformView = false,
}: {
  ticketId: string;
  messages: TicketMessage[];
  action: (formData: FormData) => Promise<{ ok: boolean; message?: string }>;
  disabled?: boolean;
  disabledNote?: string;
  /** true في لوحة المنصة — تنعكس جهة المحاذاة */
  platformView?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setError(result.message ?? 'تعذّر الإرسال.');
        return;
      }
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-4">
        {messages.map((message) => {
          const mine = platformView ? message.from_platform : !message.from_platform;
          return (
            <li key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl border px-4 py-3',
                  message.from_platform ? 'bg-primary/5 border-primary/25' : 'bg-card',
                )}
              >
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  {message.from_platform ? 'فريق معرفة AI' : 'الشركة'}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {formatDateTime(message.created_at)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {disabled ? (
        <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          {disabledNote ?? 'لا يمكن الردّ على هذه التذكرة.'}
        </p>
      ) : (
        <form ref={formRef} action={submit} className="space-y-3">
          <input type="hidden" name="ticketId" value={ticketId} />
          <Textarea
            name="body"
            required
            rows={4}
            minLength={2}
            maxLength={4000}
            placeholder="اكتب ردّك…"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={isPending}>
            <Send className="size-4" aria-hidden />
            {isPending ? 'جارٍ الإرسال…' : 'إرسال'}
          </Button>
        </form>
      )}
    </div>
  );
}
