import Link from "next/link";
import { navLinks, siteConfig } from "@/config/site";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

/**
 * قائمة الجوال تعتمد على <details> لا على حالة React: الترويسة تُعرض في كل
 * صفحة، وتحويلها إلى مكوّن عميل يُحمّل جافاسكربت على صفحات ساكنة بلا حاجة.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label={siteConfig.name}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-bold text-ink-soft transition-colors hover:bg-surface-tint hover:text-brand"
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
          <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full border border-line-strong text-ink">
            <span aria-hidden>☰</span>
            <span className="sr-only">القائمة</span>
          </summary>
          <div className="absolute left-0 top-12 w-56 rounded-2xl border border-line bg-surface p-2 shadow-[0_16px_40px_-20px_rgb(14_124_123/0.32)]">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-xl px-3 py-2 text-sm font-bold text-ink-soft hover:bg-surface-tint"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/partner/login"
              className="block rounded-xl px-3 py-2 text-sm font-bold text-ink-soft hover:bg-surface-tint"
            >
              دخول الشركاء
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
