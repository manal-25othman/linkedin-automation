import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-6xl font-extrabold text-brand">٤٠٤</p>
      <h1 className="font-display text-2xl font-bold">لم نجد هذه الصفحة</h1>
      <p className="max-w-md text-ink-muted">
        قد يكون الرابط قديمًا أو الخدمة لم تعد متاحة.
      </p>
      <div className="mt-2 flex gap-3">
        <ButtonLink href="/">الصفحة الرئيسية</ButtonLink>
        <Link href="/services" className="rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold">
          تصفّح الخدمات
        </Link>
      </div>
    </div>
  );
}
