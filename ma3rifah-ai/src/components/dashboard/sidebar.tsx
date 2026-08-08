'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/shared/brand';
import { DASHBOARD_NAV } from '@/lib/config/navigation';
import { can } from '@/lib/auth/rbac';
import { cn, initials } from '@/lib/utils';
import type { UserRole } from '@/types/database';

export interface SidebarCompany {
  name: string;
  logoUrl: string | null;
  isDemo: boolean;
}

export function SidebarNav({
  role,
  company,
  onNavigate,
}: {
  role: UserRole;
  company: SidebarCompany;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b px-5">
        <Logo href="/dashboard" />
      </div>

      {/* بطاقة الشركة */}
      <div className="border-b px-4 py-4">
        <div className="flex items-center gap-3">
          {company.logoUrl ? (
            <Image
              src={company.logoUrl}
              alt=""
              width={36}
              height={36}
              className="size-9 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
              {initials(company.name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{company.name}</p>
            {company.isDemo ? (
              <p className="text-xs text-[hsl(var(--warning))]">بيانات تجريبية</p>
            ) : null}
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5 thin-scrollbar" aria-label="التنقل">
        {DASHBOARD_NAV.map((group) => {
          const visibleItems = group.items.filter((item) => can(role, item.permission));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label ?? 'main'}>
              {group.label ? (
                <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {visibleItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive(item.href)
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {role === 'SUPER_ADMIN' ? (
          <div>
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              المنصة
            </p>
            <Link
              href="/admin"
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith('/admin')
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <ShieldCheck className="size-4 shrink-0" aria-hidden />
              إدارة المنصة
            </Link>
          </div>
        ) : null}
      </nav>
    </div>
  );
}
