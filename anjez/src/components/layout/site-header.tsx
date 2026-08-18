import Link from "next/link";
import { navLinks, siteConfig } from "@/config/site";
import { ButtonLink } from "@/components/ui/button";

/**
 * قائمة الجوال تعتمد على <details> لا على حالة React: الترويسة تُعرض في كل
 * صفحة، وتحويلها إلى مكوّن عميل يُحمّل جافاسكربت على صفحات ساكنة بلا حاجة.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-extrabold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-sm text-white">
            ✓
          </span>
          {siteConfig.name}
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-soft hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink href="/partner/login" variant="secondary" size="sm">
            دخول الشركاء
          </ButtonLink>
          <ButtonLink href="/services" size="sm">
            اطلب خدمة
          </ButtonLink>
        </div>

        <details className="relative md:hidden">
          <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg border border-line text-ink">
            <span aria-hidden>☰</span>
            <span className="sr-only">القائمة</span>
          </summary>
          <div className="absolute left-0 top-12 w-56 rounded-xl border border-line bg-surface p-2 shadow-lg">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-soft"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/partner/login"
              className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-soft"
            >
              دخول الشركاء
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
