'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, MessageCircle, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * هيكل نافذة المحادثة العائمة.
 *
 * عرض فقط: لا يعرف من أين تأتي الإجابة. يمرّر المستدعي دالة الإرسال،
 * فتصلح النافذة نفسها لمساعد الزوّار ولمساعد الموظفين معًا دون أن
 * يتسرّب منطق أحدهما إلى الآخر.
 */

export interface BubbleMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** عنصر إضافي أسفل الإجابة — المصادر مثلًا */
  extra?: React.ReactNode;
  tone?: 'default' | 'warning';
}

export interface ChatBubblePanelProps {
  title: string;
  subtitle: string;
  greeting: string;
  suggestions?: readonly string[];
  /** يُنفَّذ على الخادم ويعيد الرسالة التالية */
  onSend: (question: string) => Promise<Omit<BubbleMessage, 'id' | 'role'>>;
  placeholder?: string;
  footer?: React.ReactNode;
  /** أيقونة زر الفتح */
  launcherLabel?: string;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `m${counter}`;
}

export function ChatBubblePanel({
  title,
  subtitle,
  greeting,
  suggestions = [],
  onSend,
  placeholder = 'اكتب سؤالك…',
  footer,
  launcherLabel = 'افتح المحادثة',
}: ChatBubblePanelProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<BubbleMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, pending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // الإغلاق بمفتاح Escape — سلوك متوقّع لأي نافذة عائمة
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending) return;

    setDraft('');
    setMessages((current) => [...current, { id: nextId(), role: 'user', content: trimmed }]);
    setPending(true);

    try {
      const reply = await onSend(trimmed);
      setMessages((current) => [...current, { id: nextId(), role: 'assistant', ...reply }]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: 'assistant',
          content: 'تعذّر الرد الآن. حاول مرة أخرى بعد لحظات.',
          tone: 'warning',
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={title}
          className="flex h-[min(32rem,calc(100vh-7rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
        >
          <header className="flex items-start justify-between gap-3 bg-teal-700 px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="truncate font-semibold">{title}</p>
              <p className="truncate text-xs text-teal-100">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق المحادثة"
              className="rounded-md p-1 text-teal-100 transition hover:bg-white/15 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <Bubble role="assistant">{greeting}</Bubble>

            {messages.length === 0 && suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800 transition hover:bg-teal-100"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}

            {messages.map((message) => (
              <Bubble key={message.id} role={message.role} tone={message.tone}>
                {message.content}
                {message.extra}
              </Bubble>
            ))}

            {pending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جارٍ الرد…</span>
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
            className="flex items-center gap-2 border-t px-3 py-3"
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              maxLength={500}
              className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            />
            <button
              type="submit"
              disabled={pending || draft.trim().length === 0}
              aria-label="إرسال"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white transition hover:bg-teal-800 disabled:opacity-40"
            >
              <Send className="h-4 w-4 rtl:-scale-x-100" />
            </button>
          </form>

          {footer ? (
            <div className="border-t bg-muted/40 px-4 py-2 text-center text-[11px] leading-5 text-muted-foreground">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={launcherLabel}
          aria-expanded={false}
          aria-controls={panelId}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-white shadow-lg transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      ) : null}
    </>
  );
}

function Bubble({
  role,
  tone = 'default',
  children,
}: {
  role: 'user' | 'assistant';
  tone?: 'default' | 'warning';
  children: React.ReactNode;
}) {
  const isUser = role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-6',
          isUser
            ? 'rounded-ss-sm bg-teal-700 text-white'
            : tone === 'warning'
              ? 'rounded-se-sm bg-amber-50 text-amber-950'
              : 'rounded-se-sm bg-muted text-foreground',
        )}
      >
        {children}
      </div>
    </div>
  );
}
