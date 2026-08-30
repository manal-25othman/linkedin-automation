'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { QuickStep } from '@/content/help';

const STORAGE_KEY = 'maarifah:welcome-seen';

/**
 * نافذة الترحيب — مرّة واحدة.
 *
 * كان الدليل خلف أيقونة «؟» في الشريط العلوي، فلا يُعرف أنه دليل ولا
 * يُفتح. ومن لا يعرف أن ثمّة دليلًا لا يبحث عنه.
 *
 * والنافذة تظهر مرّة ثم لا تعود. والشرطان معًا:
 *
 *   • ألّا تكون رُفضت من قبل — الظهور المتكرّر يُدرَّب على إغلاقه قبل
 *     قراءته، فيصير وجوده وعدمه سواء.
 *
 *   • وأن يكون التجهيز ناقصًا — من رفع مستنداته وسأل أسئلته لا يحتاج
 *     ترحيبًا، ويحتاج شاشته.
 *
 * ولا تُصيَّر على الخادم: القرار يعتمد على تخزين المتصفّح، وتصييرها ثم
 * إخفاؤها يُنتج ومضةً في وجه من رفضها أمس.
 */
export function WelcomeDialog({ steps }: { steps: QuickStep[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // تخزين ممنوع (تصفّح خاصّ) ⇒ لا تظهر أصلًا. والصمت هنا أسلم من
      // نافذةٍ تعود في كل زيارة ولا سبيل إلى إسكاتها.
      return;
    }
    setOpen(true);
  }, []);

  const close = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // لا شيء — أُغلقت لهذه الجلسة على الأقل
    }
    setOpen(false);
  };

  if (steps.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>أهلًا بك في معرفة AI</DialogTitle>
          <DialogDescription>
            ثلاث خطوات تكفي للبدء. وكل ما تحتاجه بعدها في دليل الاستخدام.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3">
          {steps.slice(0, 3).map((step, index) => (
            <li key={step.title} className="flex items-start gap-3">
              <span
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={close}>
            أبدأ الآن
          </Button>
          <Button asChild onClick={close}>
            <Link href="/help">
              <BookOpen className="size-4" aria-hidden />
              افتح دليل الاستخدام
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
