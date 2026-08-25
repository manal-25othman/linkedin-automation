'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/shared/brand';
import { Button } from '@/components/ui/button';
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
 * الترويسة.
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
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center justify-between gap-6">
        <Logo />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="التنقل الرئيسي">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname === link.href
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button variant="ghost" asChild>
            <Link href="/login">تسجيل الدخول</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full border-border/80 bg-card/60">
            <Link href="/register">ابدأ التجربة</Link>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent lg:hidden"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
        >
          {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {isOpen ? (
        <div className="border-t bg-background lg:hidden">
          <nav className="container flex flex-col py-3" aria-label="التنقل للجوال">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'rounded-md px-3 py-2.5 text-sm font-medium',
                  pathname === link.href ? 'bg-accent text-primary' : 'text-muted-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t pt-3">
              <Button variant="outline" asChild>
                <Link href="/login" onClick={() => setIsOpen(false)}>
                  تسجيل الدخول
                </Link>
              </Button>
              <Button asChild>
                <Link href="/register" onClick={() => setIsOpen(false)}>
                  ابدأ التجربة
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
