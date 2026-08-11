import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { SidebarNav } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionContext();

  if (!session) redirect('/login');

  // مدير المنصة بلا شركة يذهب إلى لوحة المنصة
  if (!session.company) {
    if (session.profile.role === 'SUPER_ADMIN') redirect('/admin');
    redirect('/login');
  }

  const { profile, company } = session;

  let departmentName: string | null = null;
  if (profile.department_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('departments')
      .select('name')
      .eq('id', profile.department_id)
      .maybeSingle();
    departmentName = data?.name ?? null;
  }

  const sidebarCompany = {
    name: company.name,
    logoUrl: company.logo_url,
    isDemo: company.is_demo,
  };

  return (
    <div className="min-h-screen bg-muted/20">
      {/* الشريط الجانبي الثابت — يظهر على الشاشات الكبيرة */}
      <aside className="fixed inset-y-0 start-0 hidden w-64 border-e bg-background lg:block">
        <SidebarNav role={profile.role} company={sidebarCompany} />
      </aside>

      <div className="lg:ps-64">
        <Topbar
          user={{
            fullName: profile.full_name,
            email: profile.email,
            avatarUrl: profile.avatar_url,
            role: profile.role,
            departmentName,
          }}
          company={sidebarCompany}
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
