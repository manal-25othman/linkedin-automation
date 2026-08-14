'use client';

import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, FileText, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * عرض حيّ لدورة السؤال.
 *
 * يُظهر ما يميّز المنتج بدل أن يصفه: الجواب يأتي من مستند الشركة، ومعه
 * المصدر وصفحته، ودرجة الثقة، والتحقق من الأرقام. جملة تسويقية تقول
 * «إجابات موثوقة» يقولها كل منافس؛ أما أن يرى الزائر المصدر يظهر تحت
 * الجواب فذلك ما لا يُقال بل يُرى.
 *
 * الأرقام هنا **مثال توضيحي مكتوب في الكود** لا بيانات أحد، والصفحة
 * تقول ذلك صراحةً تحت البطاقة.
 */

const QUESTION = 'كم مدة إشعار إنهاء العقد؟';
const ANSWER =
  'مدة الإشعار ثلاثون يومًا لمن أمضى أقل من خمس سنوات، وستون يومًا بعد ذلك. ' +
  'ويُقدَّم الإشعار كتابةً عبر إدارة الموارد البشرية.';

const SOURCES = [
  { name: 'لائحة تنظيم العمل.pdf', page: 14 },
  { name: 'دليل الموظف.pdf', page: 32 },
];

/** مراحل العرض بالمللي ثانية — يعاد التسلسل بلا نهاية */
const STAGE_TYPING = 0;
const STAGE_SEARCHING = 1;
const STAGE_ANSWERING = 2;
const STAGE_VERIFIED = 3;

export function HeroDemo() {
  const [stage, setStage] = useState(STAGE_TYPING);
  const [typed, setTyped] = useState('');
  const [answerChars, setAnswerChars] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // من يطلب تقليل الحركة يرى النتيجة النهائية كاملة — لا حرمان من
    // المحتوى، إنما إسقاط للحركة وحدها.
    if (prefersReduced) {
      setTyped(QUESTION);
      setAnswerChars(ANSWER.length);
      setStage(STAGE_VERIFIED);
      return;
    }

    const schedule = (fn: () => void, delay: number) => {
      timers.current.push(setTimeout(fn, delay));
    };

    function runCycle() {
      setStage(STAGE_TYPING);
      setTyped('');
      setAnswerChars(0);

      // ١) كتابة السؤال حرفًا حرفًا
      for (let index = 1; index <= QUESTION.length; index += 1) {
        schedule(() => setTyped(QUESTION.slice(0, index)), index * 55);
      }

      const afterTyping = QUESTION.length * 55 + 350;

      // ٢) البحث في مستندات الشركة
      schedule(() => setStage(STAGE_SEARCHING), afterTyping);

      // ٣) ظهور الجواب تدريجيًا
      schedule(() => setStage(STAGE_ANSWERING), afterTyping + 1150);
      for (let index = 1; index <= ANSWER.length; index += 4) {
        schedule(
          () => setAnswerChars(Math.min(index, ANSWER.length)),
          afterTyping + 1150 + index * 8,
        );
      }

      const afterAnswer = afterTyping + 1150 + ANSWER.length * 8 + 250;

      // ٤) المصادر والثقة والتحقق من الأرقام
      schedule(() => setStage(STAGE_VERIFIED), afterAnswer);

      // ٥) إعادة الدورة بعد وقفة تكفي للقراءة
      schedule(runCycle, afterAnswer + 6500);
    }

    runCycle();

    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.length = 0;
    };
  }, []);

  const showAnswer = stage >= STAGE_ANSWERING;
  const showMeta = stage >= STAGE_VERIFIED;

  return (
    <div className="relative mx-auto max-w-2xl">
      {/* توهّج خلفي — عمق بلا صورة تُحمَّل */}
      <div
        aria-hidden
        className="animate-aurora pointer-events-none absolute -inset-x-10 -top-10 -z-10 h-64 rounded-full bg-primary/20 blur-3xl"
      />

      <div className="overflow-hidden rounded-2xl border bg-card shadow-xl shadow-foreground/5">
        {/* شريط علوي يوحي بتطبيق حقيقي */}
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-destructive/40" aria-hidden />
          <span className="size-2.5 rounded-full bg-warning/50" aria-hidden />
          <span className="size-2.5 rounded-full bg-success/50" aria-hidden />
          <p className="ms-2 text-xs text-muted-foreground">مساعد المعرفة — شركة الأفق</p>
          <span className="ms-auto text-[11px] text-muted-foreground/70" aria-hidden>
            بحث دلالي في مستندات الشركة
          </span>
        </div>

        <div className="p-5 sm:p-6" aria-live="polite">
          {/* السؤال */}
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

          {/* البحث */}
          {stage === STAGE_SEARCHING ? (
            <div className="mt-5 flex items-center gap-2 border-t pt-5 text-sm text-muted-foreground">
              <Search className="size-4 animate-pulse text-primary" aria-hidden />
              <span>يبحث في مستندات شركتك…</span>
            </div>
          ) : null}

          {/* الجواب */}
          {showAnswer ? (
            <div className="mt-5 flex items-start gap-3 border-t pt-5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="size-4 text-primary" aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <p className="min-h-[3.5rem] text-sm leading-relaxed">
                  {ANSWER.slice(0, answerChars)}
                </p>

                {showMeta ? (
                  <>
                    <div className="reveal-in mt-4 flex flex-wrap items-center gap-2">
                      {SOURCES.map((source, index) => (
                        <span
                          key={source.name}
                          className="reveal-in inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground"
                          style={{ animationDelay: `${index * 110}ms` }}
                        >
                          <FileText className="size-3" aria-hidden />
                          {source.name} — صفحة <span className="numeric">{source.page}</span>
                        </span>
                      ))}
                    </div>

                    <div className="reveal-in mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--success))]/12 px-2.5 py-1 text-xs font-medium text-[hsl(var(--success))]"
                        style={{ animationDelay: '260ms' }}
                      >
                        <BadgeCheck className="size-3.5" aria-hidden />
                        ثقة عالية
                      </span>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                        style={{ animationDelay: '360ms' }}
                      >
                        <ShieldCheck className="size-3.5" aria-hidden />
                        الأرقام مطابقة للمصدر
                      </span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        عرض توضيحي — النصوص مثال مكتوب في الصفحة، لا بيانات أي شركة.
      </p>
    </div>
  );
}

/** شارة صغيرة متحركة تُستعمل في العناوين */
export function Pulse({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex size-2', className)} aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
      <span className="relative inline-flex size-2 rounded-full bg-primary" />
    </span>
  );
}
