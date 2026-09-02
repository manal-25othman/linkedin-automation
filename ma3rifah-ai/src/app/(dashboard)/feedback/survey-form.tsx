'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { FeedbackFoundAnswers } from '@/types/database';
import { submitFeedbackSurveyAction } from './actions';

export interface SurveyDefaults {
  overallRating: number | null;
  foundAnswers: FeedbackFoundAnswers | null;
  recommendRating: number | null;
  mostUseful: string;
  missing: string;
  allowContact: boolean;
}

const FOUND_OPTIONS: Array<{ value: FeedbackFoundAnswers; label: string }> = [
  { value: 'MOSTLY', label: 'غالبًا' },
  { value: 'SOMETIMES', label: 'أحيانًا' },
  { value: 'RARELY', label: 'نادرًا' },
];

/**
 * تقييم بخمس نجوم — مجموعة أزرار راديو حقيقية كي يعمل بلوحة المفاتيح
 * وقارئ الشاشة، والنجوم رسم فوقها.
 */
function StarRating({
  name,
  value,
  onChange,
  label,
}: {
  name: string;
  value: number | null;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex gap-1" role="radiogroup">
        {[1, 2, 3, 4, 5].map((star) => (
          <label key={star} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              className="sr-only"
            />
            <Star
              className={cn(
                'size-8 transition-colors',
                value !== null && star <= value
                  ? 'fill-primary text-primary'
                  : 'text-muted-foreground/40 hover:text-primary/60',
              )}
              aria-hidden
            />
            <span className="sr-only">{star} من 5</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SurveyForm({
  defaults,
  alreadySubmitted,
}: {
  defaults: SurveyDefaults;
  alreadySubmitted: boolean;
}) {
  const router = useRouter();
  const [overall, setOverall] = useState<number | null>(defaults.overallRating);
  const [recommend, setRecommend] = useState<number | null>(defaults.recommendRating);
  const [found, setFound] = useState<FeedbackFoundAnswers | null>(defaults.foundAnswers);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
        <h2 className="mt-4 text-lg font-semibold">شكرًا لك — وصلنا رأيك</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          نقرأ كل إجابة، وما تطلبه هنا يحدّد ما نطوّره بعد ذلك.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => router.push('/assistant')}>
          العودة إلى المساعد
        </Button>
      </div>
    );
  }

  const submit = (formData: FormData) => {
    setError(null);
    if (overall === null || recommend === null || found === null) {
      setError('أجب عن أسئلة التقييم الثلاثة أولًا.');
      return;
    }
    startTransition(async () => {
      const result = await submitFeedbackSurveyAction(formData);
      if (!result.ok) {
        setError(result.message ?? 'تعذّر حفظ إجاباتك.');
        return;
      }
      setDone(true);
      router.refresh();
    });
  };

  return (
    <form action={submit} className="space-y-8">
      {alreadySubmitted ? (
        <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          أرسلت هذا الاستبيان من قبل. تستطيع تعديل إجاباتك وإرسالها من جديد.
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3.5"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      <StarRating
        name="overallRating"
        label="١. ما مدى رضاك عن المنصة عمومًا؟"
        value={overall}
        onChange={setOverall}
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">٢. هل وجدت إجابات لأسئلتك؟</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {FOUND_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                'cursor-pointer rounded-lg border px-4 py-2 text-sm transition-colors',
                found === option.value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'bg-card text-muted-foreground hover:border-primary/40',
              )}
            >
              <input
                type="radio"
                name="foundAnswers"
                value={option.value}
                checked={found === option.value}
                onChange={() => setFound(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <StarRating
        name="recommendRating"
        label="٣. هل تنصح بها زميلًا في شركة أخرى؟"
        value={recommend}
        onChange={setRecommend}
      />

      <div className="space-y-2">
        <Label htmlFor="mostUseful">٤. ما أكثر شيء أفادك؟ (اختياري)</Label>
        <Textarea
          id="mostUseful"
          name="mostUseful"
          rows={3}
          maxLength={1000}
          defaultValue={defaults.mostUseful}
          placeholder="مثال: أسأل عن اللائحة بدل أن أفتح الملف وأبحث."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="missing">٥. ما الذي ينقص أو أزعجك؟ (اختياري)</Label>
        <Textarea
          id="missing"
          name="missing"
          rows={3}
          maxLength={1000}
          defaultValue={defaults.missing}
          placeholder="كل ما تكتبه هنا يُقرأ. لا تجامل."
        />
      </div>

      <label className="flex items-start gap-3 rounded-lg border p-4 text-sm">
        <input
          type="checkbox"
          name="allowContact"
          defaultChecked={defaults.allowContact}
          className="mt-1 size-4 accent-[hsl(var(--primary))]"
        />
        <span className="leading-relaxed text-muted-foreground">
          أوافق أن يتواصل معي فريق المنصة لسؤالي عن تجربتي.
        </span>
      </label>

      <Button type="submit" size="lg" loading={isPending} disabled={isPending}>
        {isPending ? 'جارٍ الإرسال…' : alreadySubmitted ? 'تحديث إجاباتي' : 'إرسال'}
      </Button>
    </form>
  );
}
