'use client';

import { useTransition } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logoutEverywhereAction } from '@/app/(auth)/actions';

/**
 * بطاقة أمان الجلسة.
 *
 * تُبنى بمكوّنات اللوحة نفسها وتوضع بين بطاقاتها، فلا تُغيّر شكلًا ولا
 * تخترع نمطًا. والجديد فيها معلومة لا تصميم: أن للجلسة عمرًا، وكم هو.
 *
 * وإعلانُ المدة ليس تفصيلًا تقنيًا زائدًا — من يرى «تنتهي بعد ساعة سكون»
 * لا يظنّ الخروج المفاجئ عطلًا في المنصة، ولا يشكو منه للدعم.
 */
export function SessionCard({
  idleLabel,
  absoluteLabel,
}: {
  idleLabel: string;
  absoluteLabel: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
          <p>
            تنتهي جلستك بعد <span className="font-medium text-foreground">{idleLabel}</span>{' '}
            من عدم النشاط.
          </p>
          <p>
            وتنتهي في كل الأحوال بعد{' '}
            <span className="font-medium text-foreground">{absoluteLabel}</span> من تسجيل
            الدخول، حتى لو كنت تستخدمها.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          loading={isPending}
          onClick={() => {
            if (
              !window.confirm(
                'سيتم تسجيل خروجك من كل الأجهزة التي دخلت منها، بما فيها هذا الجهاز. متابعة؟',
              )
            ) {
              return;
            }
            startTransition(async () => {
              await logoutEverywhereAction();
            });
          }}
        >
          <LogOut className="size-4" aria-hidden />
          تسجيل الخروج من جميع الأجهزة
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">
          استعمله إن فقدت جهازًا أو شككت في أن أحدًا دخل بحسابك. تنتهي كل الجلسات فورًا ولا
          تُجدَّد.
        </p>
      </div>
    </div>
  );
}
