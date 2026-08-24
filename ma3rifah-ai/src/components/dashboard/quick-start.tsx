import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { quickStartFor } from '@/content/help';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import type { UserRole } from '@/types/database';

/**
 * خطوات البداية، مرقّمة، لصاحب هذا الدور وحده.
 *
 * تُعرض فوق فهرس الدليل لأن أول زائر لا يبحث — لا يعرف بعدُ عمّ يبحث.
 * وثلاث خطوات مرقّمة أمامه تُغني عن ثلاثة عشر عنوانًا يتردّد بينها.
 *
 * والخطوات مرشَّحة بالصلاحية لا بالدور اسمًا، فلا تظهر لأحد خطوةٌ
 * ينتهي بها إلى صفحة تردّه.
 */
export function QuickStart({ role }: { role: UserRole | null | undefined }) {
  const steps = quickStartFor(role);
  if (steps.length === 0) return null;

  return (
    <section className="space-y-3" aria-labelledby="quick-start-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="quick-start-heading" className="text-sm font-semibold">
          ابدئي من هنا
        </h2>
        {role ? (
          <p className="text-xs text-muted-foreground">
            الخطوات المتاحة لدورك: {ROLE_LABELS[role]}
          </p>
        ) : null}
      </div>

      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step.title}>
            <Card className="transition-colors hover:border-primary/40">
              <CardContent className="flex items-start gap-4 p-4">
                <span
                  className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium">{step.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {step.detail}
                  </p>
                  <Link
                    href={step.href}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {step.cta}
                    <ArrowLeft className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
