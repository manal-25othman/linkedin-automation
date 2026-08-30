'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CircleSlash,
  FileText,
  Search,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEMO_COMPANY, DEMO_SCENARIOS, type DemoScenario } from '@/content/demo-scenarios';

/**
 * وحدة العرض التجريبي للزائر.
 *
 * الزائر لا يشتري ما لم يره، وأقوى ما يُقنعه ليس وصف الميزة بل رؤيتها
 * تعمل: المصدر يظهر تحت الجواب، ورقم الصفحة، والمقطع الذي بُني عليه.
 *
 * **وأحد المشاهد يفشل عمدًا** — المساعد يقول «لم أجد»، وآخر يعرض تحذيرًا
 * على رقم غير مؤكد. لأن العرض الذي كل إجاباته مثالية يُقرأ إعلانًا لا
 * برهانًا، والاعتراف بالجهل هو الميزة نفسها التي نبيعها.
 *
 * والتحكّم للزائر: يختار سؤالًا فيتوقف التبديل التلقائي. ومن اختار شيئًا
 * ثم بُدِّل عنه بعد ثوانٍ يشعر أن الصفحة تنازعه.
 *
 * ويُحترم `prefers-reduced-motion`: تُعرض النتيجة كاملة بلا حركة — لا
 * حرمان من المحتوى، إنما إسقاط للحركة وحدها.
 */

const STAGE_TYPING = 0;
const STAGE_SEARCHING = 1;
const STAGE_ANSWERING = 2;
const STAGE_DONE = 3;

export function DemoConsole() {
  const [index, setIndex] = useState(0);

  // الحالة الابتدائية هي المشهد **كاملًا** لا فارغًا: هذا ما يُرسَم على
  // الخادم، فيراه زائرٌ بلا JS تامًّا بدل بطاقة خاوية، ويرى غيرُه محتوًى
  // قبل الترطيب لا شارات ومصادر معلّقة فوق جواب لم يُكتب بعد.
  const [stage, setStage] = useState(STAGE_DONE);
  const [typed, setTyped] = useState(DEMO_SCENARIOS[0].question);
  const [answerChars, setAnswerChars] = useState(DEMO_SCENARIOS[0].answer.length);
  const [locked, setLocked] = useState(false);
  const [openSource, setOpenSource] = useState<number | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scenario: DemoScenario = DEMO_SCENARIOS[index];

  useEffect(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
    setOpenSource(null);

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      setTyped(scenario.question);
      setAnswerChars(scenario.answer.length);
      setStage(STAGE_DONE);
      return;
    }

    const schedule = (fn: () => void, delay: number) => {
      timers.current.push(setTimeout(fn, delay));
    };

    setStage(STAGE_TYPING);
    setTyped('');
    setAnswerChars(0);

    for (let i = 1; i <= scenario.question.length; i += 1) {
      schedule(() => setTyped(scenario.question.slice(0, i)), i * 45);
    }

    const afterTyping = scenario.question.length * 45 + 300;
    schedule(() => setStage(STAGE_SEARCHING), afterTyping);
    schedule(() => setStage(STAGE_ANSWERING), afterTyping + 1000);

    for (let i = 1; i <= scenario.answer.length; i += 4) {
      schedule(
        () => setAnswerChars(Math.min(i, scenario.answer.length)),
        afterTyping + 1000 + i * 8,
      );
    }

    const afterAnswer = afterTyping + 1000 + scenario.answer.length * 8 + 200;
    schedule(() => setStage(STAGE_DONE), afterAnswer);

    // التبديل التلقائي يتوقف بمجرد أن يختار الزائر
    if (!locked) {
      schedule(() => setIndex((current) => (current + 1) % DEMO_SCENARIOS.length), afterAnswer + 7000);
    }

    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.length = 0;
    };
  }, [index, locked, scenario.answer, scenario.question]);

  const showAnswer = stage >= STAGE_ANSWERING;
  const showMeta = stage >= STAGE_DONE;
  const unanswered = scenario.outcome === 'UNANSWERED';
  const flagged = scenario.outcome === 'FLAGGED';

  return (
    <div className="relative mx-auto max-w-2xl">
      <div
        aria-hidden
        className="animate-aurora pointer-events-none absolute inset-x-0 -top-10 -z-10 h-64 rounded-full bg-primary/20 blur-3xl"
      />

      {/* أزرار الأسئلة — التحكّم بيد الزائر */}
      <div className="mb-3 flex flex-wrap justify-center gap-2">
        {DEMO_SCENARIOS.map((item, position) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setLocked(true);
              setIndex(position);
            }}
            aria-pressed={position === index}
            className={cn(
              // ارتفاع اللمس أربعون بكسلًا لا ثلاثون: الإصبع أعرض من
              // المؤشّر، والحبّة الصغيرة تُخطأ فتُفتح شريحةٌ لم تُقصد
              'inline-flex min-h-10 items-center rounded-full border px-4 text-xs font-medium transition-colors sm:min-h-0 sm:px-3 sm:py-1.5',
              position === index
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            {item.chip}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-xl shadow-foreground/5">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-destructive/40" aria-hidden />
          <span className="size-2.5 rounded-full bg-[hsl(var(--warning))]/50" aria-hidden />
          <span className="size-2.5 rounded-full bg-[hsl(var(--success))]/50" aria-hidden />
          <p className="ms-2 truncate text-xs text-muted-foreground">
            مساعد المعرفة — {DEMO_COMPANY}
          </p>
        </div>

        <div className="p-5 sm:p-6" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
              م
            </span>
            <p className="min-h-6 pt-1 text-sm font-medium">
              {typed}
              {stage === STAGE_TYPING ? (
                <span className="animate-caret ms-0.5 inline-block w-0.5 bg-foreground align-middle">
                  &nbsp;
                </span>
              ) : null}
            </p>
          </div>

          {stage === STAGE_SEARCHING ? (
            <div className="mt-5 flex items-center gap-2 border-t pt-5 text-sm text-muted-foreground">
              <Search className="size-4 animate-pulse text-primary" aria-hidden />
              <span>يبحث في مستندات الشركة…</span>
            </div>
          ) : null}

          {showAnswer ? (
            <div className="mt-5 flex items-start gap-3 border-t pt-5">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full',
                  unanswered ? 'bg-muted' : 'bg-primary/10',
                )}
              >
                {unanswered ? (
                  <CircleSlash className="size-4 text-muted-foreground" aria-hidden />
                ) : (
                  <Sparkles className="size-4 text-primary" aria-hidden />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="min-h-[3.5rem] text-sm leading-relaxed">
                  {scenario.answer.slice(0, answerChars)}
                </p>

                {showMeta ? (
                  <>
                    {scenario.sources.length > 0 ? (
                      <div className="reveal-in mt-4 space-y-2">
                        {scenario.sources.map((source, position) => (
                          <div key={source.name}>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenSource(openSource === position ? null : position)
                              }
                              className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                              aria-expanded={openSource === position}
                            >
                              <FileText className="size-3" aria-hidden />
                              {source.name} — صفحة{' '}
                              <span className="numeric">{source.page}</span>
                            </button>

                            {openSource === position ? (
                              <p className="reveal-in mt-1.5 rounded-md border-s-2 border-primary/40 bg-muted/30 p-2.5 text-xs leading-relaxed text-muted-foreground">
                                {source.excerpt}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="reveal-in mt-3 flex flex-wrap items-center gap-2">
                      {scenario.confidence ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium',
                            scenario.confidence === 'عالية'
                              ? 'bg-[hsl(var(--success))]/12 text-[hsl(var(--success))]'
                              : 'bg-[hsl(var(--warning))]/12 text-[hsl(var(--warning))]',
                          )}
                        >
                          <BadgeCheck className="size-3.5" aria-hidden />
                          ثقة {scenario.confidence}
                        </span>
                      ) : null}

                      {scenario.note ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium',
                            flagged
                              ? 'bg-[hsl(var(--warning))]/12 text-[hsl(var(--warning))]'
                              : 'bg-primary/10 text-primary',
                          )}
                        >
                          {flagged ? (
                            <AlertTriangle className="size-3.5" aria-hidden />
                          ) : (
                            <BadgeCheck className="size-3.5" aria-hidden />
                          )}
                          {scenario.note}
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
        عرض تجريبي — مستندات وأرقام من نسج المثال، لا بيانات أي شركة.
        {' '}اضغط على المصدر لترَي المقطع الذي بُنيت عليه الإجابة.
      </p>
    </div>
  );
}
