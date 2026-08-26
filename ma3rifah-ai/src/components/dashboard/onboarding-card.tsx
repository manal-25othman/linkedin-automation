import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import type { OnboardingProgress } from '@/lib/onboarding';

/**
 * بطاقة التجهيز.
 *
 * تُبنى ببطاقات اللوحة وأزرارها نفسها ولا تخترع نمطًا — والمطلوب إضافةُ
 * وظيفة لا تغييرُ شكل.
 *
 * وتختفي عند الاكتمال بلا رسالة تهنئة: من أنجز الخطوات لا يحتاج أن
 * يُقال له ذلك، ويحتاج المساحة لبياناته. وتبقى في اللوحة ما دامت خطوة
 * ناقصة، فلا تُخفى بضغطة يُنسى أثرها.
 *
 * ونداء الفعل على **الخطوة التالية وحدها**: خمسة أزرار متجاورة تُشتّت،
 * وزرٌّ واحد يقول ماذا الآن.
 */
export function OnboardingCard({ progress }: { progress: OnboardingProgress }) {
  if (progress.complete) return null;

  return (
    <Card className="border-primary/25 bg-primary/5">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">أكمِل تجهيز مساحتك</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              أنجزت {progress.doneCount} من {progress.totalCount} خطوات.
            </p>
          </div>
          <span className="text-2xl font-bold tabular-nums text-primary">
            {progress.percent}٪
          </span>
        </div>

        <Progress value={progress.percent} />

        <ol className="space-y-2.5">
          {progress.steps.map((step) => (
            <li key={step.id} className="flex items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                  step.done
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/30 bg-background',
                )}
              >
                {step.done ? <Check className="size-3" /> : null}
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-sm font-medium',
                    step.done && 'text-muted-foreground line-through decoration-1',
                  )}
                >
                  {step.title}
                  <span className="sr-only">{step.done ? ' — مُنجزة' : ' — لم تُنجز بعد'}</span>
                </p>
                {!step.done ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        {progress.next ? (
          <Button asChild>
            <Link href={progress.next.href}>
              {progress.next.cta}
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
