import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, LayoutDashboard, LogOut, Receipt } from 'lucide-react';
import { getSessionContext } from '@/lib/auth/session';
import { Logo } from '@/components/shared/brand';
import { Badge } from '@/components/ui/badge';
import { logoutAction } from '@/app/(auth)/actions';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext();

  if (!session) redirect('/login');
  if (session.profile.role !== 'SUPER_ADMIN') redirect('/dashboard');

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="flex h-16 items-center justify-between gap-6 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo href="/admin" />
            <Badge variant="warning">إدارة المنصة</Badge>
          </div>

          <nav className="flex items-center gap-1" aria-label="تنقل إدارة المنصة">
            <Link
              href="/admin"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LayoutDashboard className="me-2 inline size-4" aria-hidden />
              نظرة عامة
            </Link>
            <Link
              href="/admin/companies"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Building2 className="me-2 inline size-4" aria-hidden />
              الشركات
            </Link>
            <Link
              href="/admin/plans"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Receipt className="me-2 inline size-4" aria-hidden />
              الخطط
            </Link>

            <form action={logoutAction}>
              <button
                type="submit"
                className="ms-2 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="size-4" aria-hidden />
                خروج
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
