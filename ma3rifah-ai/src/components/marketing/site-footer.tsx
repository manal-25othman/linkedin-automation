import Link from 'next/link';
import { Logo } from '@/components/shared/brand';
import { getSiteText } from '@/lib/content/site-text';

const FOOTER_SECTIONS = [
  {
    title: 'المنتج',
    links: [
      { href: '/features', label: 'المميزات' },
      { href: '/how-it-works', label: 'كيف يعمل' },
      { href: '/pricing', label: 'الأسعار' },
    ],
  },
  {
    title: 'الشركة',
    links: [
      { href: '/about', label: 'نبذة عنا' },
      { href: '/security', label: 'الأمان والخصوصية' },
      { href: '/faq', label: 'الأسئلة الشائعة' },
      { href: '/contact', label: 'تواصل معنا' },
    ],
  },
  {
    title: 'الحساب',
    links: [
      { href: '/login', label: 'تسجيل الدخول' },
      { href: '/register', label: 'إنشاء حساب' },
    ],
  },
  {
    title: 'قانوني',
    links: [
      { href: '/privacy', label: 'سياسة الخصوصية' },
      { href: '/terms', label: 'شروط الاستخدام' },
    ],
  },
];

export async function SiteFooter() {
  const t = await getSiteText();

  return (
    <footer className="relative overflow-hidden border-t">
      <div className="mk-mesh pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="container relative py-16">
        <div className="grid gap-12 lg:grid-cols-[1.6fr_repeat(4,1fr)]">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-5 text-sm leading-loose text-muted-foreground">
              {t('site.tagline')}
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-bold">{section.title}</h3>
              <ul className="mt-4 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      // ارتفاع اللمس على الهاتف: الرابط النصّي ستّة عشر
                      // بكسلًا، والإصبع يخطئه إلى جاره فوقه أو تحته
                      className="inline-flex min-h-9 items-center text-sm text-muted-foreground transition-colors hover:text-primary sm:min-h-0"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-border/60 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} بديهة. جميع الحقوق محفوظة.</p>
          <p className="text-xs">صُنعت في المملكة العربية السعودية</p>
        </div>
      </div>
    </footer>
  );
}
