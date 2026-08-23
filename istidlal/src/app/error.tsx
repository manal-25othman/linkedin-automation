"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * حدّ الخطأ. رسالة صريحة بلا تفاصيل داخلية: القارئ يعرف ما حدث وما يفعله،
 * ولا يرى أثر التنفيذ. التفاصيل تذهب إلى سجلّ الخادم.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("صفحة تعطّلت", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start px-4 py-24 sm:px-6">
      <p className="font-mono text-sm text-ink-faint">خطأ غير متوقّع</p>
      <h1 className="mt-4 font-display text-3xl font-bold text-ink md:text-4xl">
        تعطّلت هذه الصفحة.
      </h1>
      <p className="mt-4 text-lg leading-9 text-ink-muted">
        العطل من عندنا لا من عندك. أعد المحاولة، وإن تكرّر فالأرشيف الكامل يعمل من هنا.
      </p>

      {error.digest && (
        <p className="mt-3 text-xs text-ink-faint numerals-latn">
          رمز العطل: {error.digest}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-signal px-6 py-3 text-sm font-semibold text-white transition hover:bg-signal-hover"
        >
          أعد المحاولة
        </button>
        <Link
          href="/articles"
          className="rounded-xl border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition hover:border-signal-line hover:text-signal"
        >
          الأرشيف الكامل
        </Link>
      </div>
    </div>
  );
}
