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
    <footer className="border-t bg-muted/25">
      <div className="container py-14">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {t('site.tagline')}
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold">{section.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} معرفة AI. جميع الحقوق محفوظة.</p>
          <p>صُنع للشركات في المملكة العربية السعودية.</p>
        </div>
      </div>
    </footer>
  );
}
