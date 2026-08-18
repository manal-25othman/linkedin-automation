import Link from "next/link";

export const metadata = { title: "الصفحة غير موجودة" };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <p className="font-display text-6xl font-bold text-signal numerals-latn">404</p>
      <h1 className="mt-6 font-display text-3xl font-bold text-ink">لا توجد صفحة هنا</h1>
      <p className="mt-4 text-ink-muted">
        الرابط قد يكون قديمًا أو فيه خطأ إملائي. جرّب البحث، أو ابدأ من أرشيف المقالات.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/articles"
          className="rounded-xl bg-signal px-6 py-3 text-sm font-semibold text-white transition hover:bg-signal-hover"
        >
          أرشيف المقالات
        </Link>
        <Link
          href="/search"
          className="rounded-xl border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition hover:border-signal-line hover:text-signal"
        >
          البحث
        </Link>
      </div>
    </div>
  );
}
