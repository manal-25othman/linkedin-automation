'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/shared/brand';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/marketing/theme-toggle';
import { cn } from '@/lib/utils';

interface NavLink {
  href: string;
  label: string;
}

const NAV_LINKS: NavLink[] = [
  { href: '/about', label: 'نبذة عنا' },
  { href: '/features', label: 'المميزات' },
  { href: '/how-it-works', label: 'كيف يعمل' },
  { href: '/pricing', label: 'الأسعار' },
  { href: '/security', label: 'الأمان' },
  { href: '/faq', label: 'الأسئلة الشائعة' },
  { href: '/contact', label: 'تواصل معنا' },
];

/**
 * الترويسة: شريطٌ عائم مستدير يطفو فوق الصفحة لا حدٌّ يقطعها.
 *
 * الروابط الثابتة مكتوبة هنا، والصفحات التي يصنعها مالك المنصة تصل
 * `extraLinks` من التخطيط. وترتيبها بعد الثابتة وقبل «تواصل معنا»:
 * «تواصل معنا» آخر ما تُقرأ عادةً في قائمة، وإقحام صفحة جديدة بعده
 * يدفعه إلى وسط القائمة فيضيع.
 */
export function SiteHeader({ extraLinks = [] }: { extraLinks?: NavLink[] }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const links =
    extraLinks.length === 0
      ? NAV_LINKS
      : [...NAV_LINKS.slice(0, -1), ...extraLinks, ...NAV_LINKS.slice(-1)];

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
      <div className="container !px-0 sm:!px-4">
        <div className="mk-nav relative flex h-14 items-center justify-between gap-4 rounded-full border border-border/70 pe-2 ps-4">
          <Logo />

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="التنقل الرئيسي">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                  pathname === link.href
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-1.5 lg:flex">
            <ThemeToggle />
            <Button variant="ghost" asChild className="rounded-full">
              <Link href="/login">تسجيل الدخول</Link>
            </Button>
            <Button asChild className="mk-cta h-10 rounded-full border-0 px-5 font-semibold">
              <Link href="/register">ابدأ التجربة</Link>
            </Button>
          </div>

          {/* على الهاتف يجاور المبدّلُ زرَّ القائمة: هو تفضيل عرضٍ لا
              وجهةَ تنقّل، فلا يُدفن داخل قائمة تُفتح. */}
          <div className="flex items-center gap-1 lg:hidden">
            <ThemeToggle />
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
              onClick={() => setIsOpen((open) => !open)}
              aria-expanded={isOpen}
              aria-label={isOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            >
              {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {isOpen ? (
          <div className="mk-nav mt-2 rounded-3xl border border-border/70 p-2 lg:hidden">
            <nav className="flex flex-col" aria-label="التنقل للجوال">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'rounded-2xl px-4 py-3 text-sm font-medium',
                    pathname === link.href
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border/60 p-2 pt-4">
                <Button variant="outline" asChild className="rounded-full">
                  <Link href="/login" onClick={() => setIsOpen(false)}>
                    تسجيل الدخول
                  </Link>
                </Button>
                <Button asChild className="mk-cta rounded-full border-0">
                  <Link href="/register" onClick={() => setIsOpen(false)}>
                    ابدأ التجربة
                  </Link>
                </Button>
              </div>
            </nav>
          </div>
        ) : null}
      </div>
    </header>
  );
}
