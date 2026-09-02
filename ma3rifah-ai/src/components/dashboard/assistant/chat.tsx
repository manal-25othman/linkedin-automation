'use client';

import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Check,
  Copy,
  CornerDownLeft,
  FileText,
  Sparkles,
  MessageSquareHeart,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn, formatNumber } from '@/lib/utils';
import { askAction, feedbackAction } from '@/app/(dashboard)/assistant/actions';
import type { AnswerSource } from '@/lib/ai/chat-service';
import Link from 'next/link';
import {
  FEEDBACK_SURVEY_DISMISSED_KEY,
  FEEDBACK_SURVEY_MIN_ANSWERS,
  FEEDBACK_SURVEY_PATH,
} from '@/lib/config/feedback';

/**
 * شارة درجة الثقة.
 *
 * تُعرض بجانب المصادر لا فوق الإجابة: القارئ يحتاجها وهو يقرّر إن كان
 * سيتحقّق من المستند الأصلي، لا وهو يقرأ الجواب.
 *
 * «منخفضة» لا تعني خطأً، بل أن الإجابة لم يقابلها نص صريح كافٍ في
 * المصادر — وهذا موضع المراجعة اليدوية.
 */
function ConfidenceBadge({ level }: { level?: 'HIGH' | 'MEDIUM' | 'LOW' | null }) {
  if (!level) return null;

  const config = {
    HIGH: { label: 'ثقة عالية', variant: 'success' as const },
    MEDIUM: { label: 'ثقة متوسطة', variant: 'muted' as const },
    LOW: { label: 'ثقة منخفضة — راجع المصدر', variant: 'warning' as const },
  }[level];

  return (
    <Badge variant={config.variant} title="تُحسب من تطابق الإجابة مع نص المصادر ومن تحقّق أرقامها">
      {config.label}
    </Badge>
  );
}

export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  feedback: 'UP' | 'DOWN' | null;
  isUnanswered: boolean;
  sources: AnswerSource[];
  /** درجة ثقة مركّبة ∈ [0,1] — null للرسائل القديمة أو غير المُجابة */
  confidenceLevel?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  /** رسالة مؤقتة معروضة قبل وصول رد الخادم */
  pending?: boolean;
}

/**
 * أسئلة البداية الافتراضية — تظهر فقط إن لم يكتب مدير الشركة أسئلته
 * في الإعدادات. عامّة عمدًا: لا تدّعي معرفة ما في مستندات شركة بعينها.
 */
export const DEFAULT_STARTER_QUESTIONS = [
  'كم عدد أيام الإجازة السنوية؟',
  'كيف أطلب إجازة؟',
  'هل يُسمح بالعمل عن بعد؟',
  'كيف أطلب جهاز حاسب جديد؟',
  'ما سياسة استخدام البريد الإلكتروني؟',
  'ماذا أفعل عند فقدان جهاز الشركة؟',
];

export function Chat({
  conversationId,
  initialMessages,
  isAiConfigured,
  hasDocuments,
  starterQuestions = [],
  answeredCount = 0,
  surveyDone = false,
}: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  isAiConfigured: boolean;
  hasDocuments: boolean;
  /** أسئلة البداية من إعدادات الشركة؛ الفراغ يعني الافتراضية */
  starterQuestions?: string[];
  /** إجابات المساعد الفعلية للمستخدم الحالي — عدّاد دعوة الاستبيان */
  answeredCount?: number;
  /** أرسل المستخدم الاستبيان من قبل — فلا دعوة */
  surveyDone?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [activeConversationId, setActiveConversationId] = useState(conversationId);
  const [question, setQuestion] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
    setActiveConversationId(conversationId);
  }, [initialMessages, conversationId]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const send = (rawQuestion: string) => {
    const trimmed = rawQuestion.trim();
    if (trimmed.length < 2 || isPending) return;

    setError(null);
    setQuestion('');

    const optimisticId = `pending-${Date.now()}`;
    setMessages((current) => [
      ...current,
      {
        id: optimisticId,
        role: 'USER',
        content: trimmed,
        feedback: null,
        isUnanswered: false,
        sources: [],
      },
      {
        id: `${optimisticId}-answer`,
        role: 'ASSISTANT',
        content: '',
        feedback: null,
        isUnanswered: false,
        sources: [],
        pending: true,
      },
    ]);

    startTransition(async () => {
      const response = await askAction({
        question: trimmed,
        conversationId: activeConversationId,
      });

      if (!response.ok || !response.data) {
        // نُزيل الرسالة المؤقتة ونُبقي سؤال المستخدم في الحقل ليعيد المحاولة
        setMessages((current) =>
          current.filter(
            (message) => message.id !== optimisticId && message.id !== `${optimisticId}-answer`,
          ),
        );
        setQuestion(trimmed);
        setError(response.message ?? 'تعذّر الحصول على إجابة. حاول مرة أخرى.');
        return;
      }

      const { data } = response;

      setMessages((current) =>
        current.map((message) =>
          message.id === `${optimisticId}-answer`
            ? {
                id: data.assistantMessageId,
                role: 'ASSISTANT',
                content: data.answer,
                feedback: null,
                isUnanswered: data.isUnanswered,
                sources: data.sources,
                confidenceLevel: data.confidenceLevel,
              }
            : message,
        ),
      );

      if (!activeConversationId) {
        setActiveConversationId(data.conversationId);
        // نُحدّث المسار دون إعادة تحميل حتى لا تضيع الرسائل المعروضة
        window.history.replaceState(null, '', `/assistant/${data.conversationId}`);
        router.refresh();
      }
    });
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col">
      {/* منطقة الرسائل */}
      <div className="flex-1 overflow-y-auto thin-scrollbar">
        {isEmpty ? (
          <WelcomePanel
            hasDocuments={hasDocuments}
            suggestions={starterQuestions.length > 0 ? starterQuestions : DEFAULT_STARTER_QUESTIONS}
            onPick={(suggestion) => {
              setQuestion(suggestion);
              textareaRef.current?.focus();
            }}
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-1 pb-6 pt-2">
            {messages.map((message) =>
              message.role === 'USER' ? (
                <UserBubble key={message.id} content={message.content} />
              ) : (
                <AssistantBubble key={message.id} message={message} />
              ),
            )}
            <div ref={scrollAnchorRef} />
          </div>
        )}
      </div>

      {/* حقل الإدخال */}
      <div className="border-t bg-background pt-4">
        <div className="mx-auto max-w-3xl">
          <SurveyNudge answeredCount={answeredCount} surveyDone={surveyDone} />

          {error ? (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : null}

          {!isAiConfigured ? (
            <div className="mb-3 rounded-lg border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 p-3">
              <p className="text-sm text-[hsl(var(--warning))]">
                المساعد الذكي غير مُهيّأ على هذا الخادم. راجع إعداد ANTHROPIC_API_KEY.
              </p>
            </div>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              send(question);
            }}
            className="relative"
          >
            <Textarea
              ref={textareaRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send(question);
                }
              }}
              placeholder="اسأل عن سياسات الشركة وإجراءاتها…"
              rows={2}
              maxLength={2000}
              disabled={isPending || !isAiConfigured}
              className="min-h-[64px] resize-none pe-14 text-[15px]"
              aria-label="سؤالك"
            />
            <Button
              type="submit"
              size="icon"
              className="absolute bottom-3 end-3"
              disabled={question.trim().length < 2 || isPending || !isAiConfigured}
              loading={isPending}
              aria-label="إرسال"
            >
              {isPending ? null : <CornerDownLeft className="size-4" aria-hidden />}
            </Button>
          </form>

          <p className="mt-2 text-center text-xs text-muted-foreground">
            الإجابات مبنية على مستندات شركتك. تحقّق من المصدر قبل اتخاذ قرار.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- المكوّنات */

/**
 * دعوة الاستبيان — تظهر بعد FEEDBACK_SURVEY_MIN_ANSWERS إجابة فعلية.
 *
 * ثلاثة شروط كلها لازمة: عدد إجابات كافٍ، ولم يرسل الاستبيان من قبل،
 * ولم يغلق الدعوة من قبل. والإغلاق يُحفظ في المتصفح فلا تعود — ما يظهر
 * في كل زيارة يُدرَّب المستخدم على إغلاقه قبل قراءته.
 *
 * تبدأ مخفيّة وتُقرَّر في useEffect لا أثناء التصيير: الخادم لا يعرف
 * localStorage، ولو صُيّرت ظاهرةً ثم اختفت لقفزت الصفحة.
 */
function SurveyNudge({ answeredCount, surveyDone }: { answeredCount: number; surveyDone: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (surveyDone || answeredCount < FEEDBACK_SURVEY_MIN_ANSWERS) return;
    try {
      if (localStorage.getItem(FEEDBACK_SURVEY_DISMISSED_KEY)) return;
    } catch {
      return;
    }
    setVisible(true);
  }, [answeredCount, surveyDone]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(FEEDBACK_SURVEY_DISMISSED_KEY, '1');
    } catch {
      // متصفح يمنع التخزين: تختفي لهذه الزيارة فقط، ولا بأس
    }
  };

  if (!visible) return null;

  return (
    <div
      role="status"
      className="mb-3 flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3.5"
    >
      <MessageSquareHeart className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">شاركنا رأيك — دقيقتان</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          جرّبت المساعد عدة مرات الآن. رأيك يحدّد ما نطوّره بعد ذلك.
        </p>
        <Link
          href={FEEDBACK_SURVEY_PATH}
          onClick={dismiss}
          className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          افتح الاستبيان
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="إغلاق الدعوة"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function WelcomePanel({
  hasDocuments,
  suggestions,
  onPick,
}: {
  hasDocuments: boolean;
  suggestions: string[];
  onPick: (suggestion: string) => void;
}) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
        <Sparkles className="size-6 text-primary" aria-hidden />
      </div>
      <h2 className="mt-5 text-lg font-semibold">كيف يمكنني مساعدتك؟</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        اسأل عن أي سياسة أو إجراء في شركتك، وسأجيبك من مستنداتها مع ذكر المصدر.
      </p>

      {!hasDocuments ? (
        <div className="mt-6 rounded-lg border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 p-4 text-start">
          <p className="text-sm leading-relaxed text-[hsl(var(--warning))]">
            قاعدة المعرفة لا تحتوي على مستندات جاهزة بعد، لذا لن أجد إجابات عن أسئلة
            الشركة. اطلب من مدير الشركة رفع المستندات أولًا.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onPick(suggestion)}
              className="rounded-lg border bg-card px-4 py-3 text-start text-sm transition-colors hover:border-primary/40 hover:bg-accent"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-se-md bg-secondary px-4 py-3">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{content}</p>
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: ChatMessage }) {
  const [feedback, setFeedback] = useOptimistic(message.feedback);
  const [copied, setCopied] = useState(false);
  const [askingWhy, setAskingWhy] = useState(false);
  const [note, setNote] = useState('');
  const [noteSent, setNoteSent] = useState(false);
  const [, startFeedbackTransition] = useTransition();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('تعذّر نسخ الإجابة.');
    }
  };

  /*
   * «لم تعجبني» وحدها تفتح حقل السبب.
   *
   * والتقييم يُحفظ فورًا لا بعد كتابة السبب: من ضغط ثم انصرف يبقى
   * رأيه محسوبًا. والسبب زيادةٌ اختيارية تُرسَل بعده.
   */
  const rate = (value: 'UP' | 'DOWN') => {
    const next = feedback === value ? null : value;
    startFeedbackTransition(async () => {
      setFeedback(next);
      setAskingWhy(next === 'DOWN');
      if (next !== 'DOWN') setNote('');
      const result = await feedbackAction(message.id, next);
      if (!result.ok) toast.error(result.message ?? 'تعذّر حفظ التقييم.');
    });
  };

  const sendNote = () => {
    const text = note.trim();
    if (text === '') return;
    startFeedbackTransition(async () => {
      const result = await feedbackAction(message.id, 'DOWN', text);
      if (result.ok) {
        setAskingWhy(false);
        setNoteSent(true);
        toast.success('وصلنا سببك. شكرًا.');
      } else {
        toast.error(result.message ?? 'تعذّر إرسال السبب.');
      }
    });
  };

  if (message.pending) {
    return (
      <div className="flex gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="size-4 text-primary" aria-hidden />
        </div>
        <div className="flex items-center gap-2 pt-1.5" role="status">
          <span className="size-2 animate-pulse rounded-full bg-muted-foreground/60" />
          <span
            className="size-2 animate-pulse rounded-full bg-muted-foreground/60"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="size-2 animate-pulse rounded-full bg-muted-foreground/60"
            style={{ animationDelay: '300ms' }}
          />
          <span className="ms-1 text-sm text-muted-foreground">
            جاري البحث في قاعدة المعرفة…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="size-4 text-primary" aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'rounded-2xl rounded-ss-md border px-4 py-3',
            message.isUnanswered
              ? 'border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5'
              : 'bg-card',
          )}
        >
          <p className="answer-prose whitespace-pre-wrap">{message.content}</p>
        </div>

        {message.sources.length > 0 ? (
          <div className="mt-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                المصادر التي بُنيت عليها الإجابة
              </p>
              <ConfidenceBadge level={message.confidenceLevel} />
            </div>
            <ul className="space-y-2">
              {message.sources.map((source, index) => (
                <li
                  key={`${source.documentId}-${source.pageNumber ?? index}`}
                  className="rounded-lg border bg-muted/30 px-3 py-2.5"
                >
                  <div className="flex items-start gap-2.5">
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium">{source.documentName}</span>
                        {source.pageNumber ? (
                          <Badge variant="muted">صفحة {formatNumber(source.pageNumber)}</Badge>
                        ) : null}
                        {source.sectionTitle ? (
                          <span className="text-xs text-muted-foreground">
                            {source.sectionTitle}
                          </span>
                        ) : null}
                      </div>
                      {source.excerpt ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          {source.excerpt}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-2.5 flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={copy} aria-label="نسخ الإجابة">
            {copied ? (
              <Check className="size-4 text-[hsl(var(--success))]" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => rate('UP')}
            aria-label="إجابة مفيدة"
            aria-pressed={feedback === 'UP'}
          >
            <ThumbsUp
              className={cn('size-4', feedback === 'UP' && 'text-[hsl(var(--success))]')}
              aria-hidden
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => rate('DOWN')}
            aria-label="إجابة غير مفيدة"
            aria-pressed={feedback === 'DOWN'}
          >
            <ThumbsDown
              className={cn('size-4', feedback === 'DOWN' && 'text-destructive')}
              aria-hidden
            />
          </Button>
        </div>

        {/*
          حقل السبب.
          يُفصح صراحةً إلى أين يذهب: نصٌّ يكتبه موظفٌ عن مستند شركته
          ويصل إلى فريق المنصة — وجمعُه بلا إخبارٍ إخلالٌ بالثقة، مهما
          حسُنت النية.
        */}
        {askingWhy ? (
          <div className="mt-3 rounded-lg border bg-muted/40 p-3">
            <label
              htmlFor={`why-${message.id}`}
              className="block text-xs font-medium"
            >
              ما سبب عدم الرضا؟ (اختياري)
            </label>
            <Textarea
              id={`why-${message.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="مثال: الإجابة ناقصة · المصدر غير صحيح · لم يفهم السؤال"
              className="mt-2 text-sm"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
                يصل إلى فريق المنصة لتحسين جودة الإجابات.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setAskingWhy(false)}
                >
                  تخطٍّ
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={sendNote}
                  disabled={note.trim() === ''}
                >
                  إرسال
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {noteSent ? (
          <p className="mt-2 text-xs text-muted-foreground">
            شكرًا — وصلنا سببك.
          </p>
        ) : null}
      </div>
    </div>
  );
}
