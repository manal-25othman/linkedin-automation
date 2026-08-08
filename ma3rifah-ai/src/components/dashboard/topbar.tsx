'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogOut, Menu, Settings, User, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { SidebarNav, type SidebarCompany } from '@/components/dashboard/sidebar';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import { initials } from '@/lib/utils';
import { logoutAction } from '@/app/(auth)/actions';
import type { UserRole } from '@/types/database';

export interface TopbarUser {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  departmentName: string | null;
}

export function Topbar({
  user,
  company,
}: {
  user: TopbarUser;
  company: SidebarCompany;
}) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent lg:hidden"
          onClick={() => setIsMobileNavOpen(true)}
          aria-label="فتح القائمة"
        >
          <Menu className="size-5" />
        </button>

        <div className="hidden min-w-0 flex-1 lg:block" />

        <div className="flex items-center gap-3">
          <Badge variant="muted" className="hidden sm:inline-flex">
            {ROLE_LABELS[user.role]}
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Avatar>
                {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                <AvatarFallback>{initials(user.fullName || user.email)}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm font-medium text-foreground">
                  {user.fullName || 'مستخدم'}
                </p>
                <p className="mt-0.5 truncate text-xs" dir="ltr">
                  {user.email}
                </p>
                {user.departmentName ? (
                  <p className="mt-1.5 text-xs">قسم {user.departmentName}</p>
                ) : null}
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link href="/settings/profile">
                  <User aria-hidden />
                  الملف الشخصي
                </Link>
              </DropdownMenuItem>

              {user.role === 'COMPANY_ADMIN' || user.role === 'SUPER_ADMIN' ? (
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings aria-hidden />
                    إعدادات الشركة
                  </Link>
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuSeparator />

              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm text-destructive outline-none transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="size-4 shrink-0" aria-hidden />
                  تسجيل الخروج
                </button>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* درج التنقل للجوال */}
      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/45"
            onClick={() => setIsMobileNavOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 start-0 w-72 bg-background shadow-xl">
            <button
              type="button"
              className="absolute end-3 top-4 z-10 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              onClick={() => setIsMobileNavOpen(false)}
              aria-label="إغلاق القائمة"
            >
              <X className="size-5" />
            </button>
            <SidebarNav
              role={user.role}
              company={company}
              onNavigate={() => setIsMobileNavOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
