import Link from "next/link";
import { requireStaff } from "@/lib/auth/guard";
import { logout } from "@/app/actions/auth";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { Logo } from "@/components/layout/logo";

const nav = [
  { href: "/admin", label: "المؤشرات" },
  { href: "/admin/orders", label: "الطلبات" },
  { href: "/admin/services", label: "الخدمات" },
  { href: "/admin/categories", label: "التصنيفات" },
  { href: "/admin/affiliates", label: "المسوّقون" },
  { href: "/admin/commissions", label: "العمولات" },
  { href: "/admin/payouts", label: "السحوبات" },
  { href: "/admin/coupons", label: "أكواد الخصم" },
  { href: "/admin/settings", label: "الإعدادات" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface-dark text-white">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label={siteConfig.name}>
              <Logo onDark />
            </Link>
            <Badge tone="accent">لوحة الإدارة</Badge>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-white/70 sm:inline">{user.email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-full border border-white/25 px-4 py-1.5 font-bold text-white hover:bg-white/10"
              >
                خروج
              </button>
            </form>
          </div>
        </div>

        <nav className="container-page flex gap-1 overflow-x-auto border-t border-white/10 py-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold text-white/75 hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="container-page py-8">{children}</main>
    </div>
  );
}
