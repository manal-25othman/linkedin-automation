'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * حدود الخطأ العامة.
 * لا تُعرض تفاصيل تقنية للمستخدم — فقط معرّف الحدث للرجوع إليه في السجلات.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'خطأ غير معالج في الواجهة',
        timestamp: new Date().toISOString(),
        context: { digest: error.digest },
      }),
    );
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" aria-hidden />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight">حدث خطأ غير متوقع</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        تم تسجيل المشكلة وسنعمل على معالجتها. يمكنك المحاولة مرة أخرى، وإن تكرر الخطأ
        فتواصل مع الدعم.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground" dir="ltr">
          {error.digest}
        </p>
      ) : null}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>المحاولة مرة أخرى</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">العودة إلى لوحة التحكم</Link>
        </Button>
      </div>
    </div>
  );
}
