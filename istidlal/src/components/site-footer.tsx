import Link from "next/link";

import { LogoMark } from "./logo";
import { categories } from "@/config/categories";
import { legalNav, primaryNav } from "@/config/nav";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="flex items-center gap-2.5">
            <LogoMark size={34} />
            <span className="font-display text-lg font-bold text-ink">استدلال</span>
          </div>
          <p className="mt-4 text-sm leading-7 text-ink-muted">
            هندسة أنظمة الذكاء الاصطناعي التطبيقية بالعربية — بالقياس لا بالانطباع.
          </p>
          <div className="mt-5 flex gap-2">
            <FooterSocial href={siteConfig.social.linkedin} label="لينكدإن">
              <path d="M6.94 8.5H4.2V20h2.74V8.5ZM5.57 4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM20 13.6c0-3.1-1.66-4.55-3.87-4.55-1.79 0-2.58 1-3.03 1.7V8.5H10.4V20h2.7v-6.16c0-1.62.31-3.2 2.32-3.2 1.98 0 2 1.86 2 3.3V20H20v-6.4Z" />
            </FooterSocial>
            <FooterSocial href={siteConfig.social.x} label="إكس">
              <path d="M17.2 3h3.3l-7.2 8.2L21.8 21h-6.6l-4.4-5.6L5.6 21H2.3l7.7-8.8L2.5 3h6.8l4 5.2L17.2 3Zm-1.2 16h1.8L8.1 4.9H6.2L16 19Z" />
            </FooterSocial>
            <FooterSocial href={siteConfig.social.rss} label="RSS">
              <path d="M5 18.5a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8ZM4 10.2v2.7a5.9 5.9 0 0 1 5.9 5.9h2.7c0-4.7-3.8-8.6-8.6-8.6Zm0-4.8v2.7c5.9 0 10.7 4.8 10.7 10.7h2.7C17.4 11.3 11.4 5.4 4 5.4Z" />
            </FooterSocial>
          </div>
        </div>

        <FooterColumn title="التصنيفات">
          {categories.map((category) => (
            <FooterLink key={category.slug} href={`/categories/${category.slug}`}>
              {category.name}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title="الموقع">
          {primaryNav.map((item) => (
            <FooterLink key={item.href} href={item.href}>
              {item.label}
            </FooterLink>
          ))}
          <FooterLink href="/newsletter">النشرة البريدية</FooterLink>
          <FooterLink href="/rss.xml">تغذية RSS</FooterLink>
        </FooterColumn>

        <FooterColumn title="السياسات">
          {legalNav.map((item) => (
            <FooterLink key={item.href} href={item.href}>
              {item.label}
            </FooterLink>
          ))}
        </FooterColumn>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="numerals-latn">© {year} استدلال — جميع الحقوق محفوظة.</p>
          <p>
            للتواصل التحريري:{" "}
            <a className="text-signal hover:underline" href={`mailto:${siteConfig.email}`}>
              {siteConfig.email}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-sm font-bold text-ink">{title}</h2>
      <ul className="mt-4 flex flex-col gap-2.5 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-ink-muted transition hover:text-signal">
        {children}
      </Link>
    </li>
  );
}

function FooterSocial({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      rel="noopener noreferrer me"
      target="_blank"
      className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-muted transition hover:border-signal-line hover:text-signal"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {children}
      </svg>
    </a>
  );
}
