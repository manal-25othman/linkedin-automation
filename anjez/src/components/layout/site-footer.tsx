import Link from "next/link";
import { siteConfig } from "@/config/site";

const columns = [
  {
    title: "المنصّة",
    links: [
      { href: "/services", label: "كل الخدمات" },
      { href: "/track", label: "تتبّع طلبك" },
      { href: "/affiliate", label: "برنامج العمولة" },
    ],
  },
  {
    title: "الشركاء",
    links: [
      { href: "/partner/register", label: "انضم كمسوّق" },
      { href: "/partner/login", label: "دخول المسوّقين" },
    ],
  },
  {
    title: "قانوني",
    links: [
      { href: "/terms", label: "الشروط والأحكام" },
      { href: "/privacy", label: "سياسة الخصوصية" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div>
          <p className="font-display text-lg font-extrabold">{siteConfig.name}</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-muted">
            {siteConfig.tagline}
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <p className="mb-3 text-sm font-bold text-ink">{column.title}</p>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-muted transition-colors hover:text-brand"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-line py-5">
        <p className="container-page text-center text-xs text-ink-faint">
          © {new Date().getFullYear()} {siteConfig.name}. جميع الحقوق محفوظة.
        </p>
      </div>
    </footer>
  );
}
