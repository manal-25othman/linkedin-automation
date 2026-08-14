import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { SidebarNav } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { FloatingDock } from '@/components/shared/floating-dock';
import { AssistantWidget } from '@/components/dashboard/assistant-widget';

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

  const supabase = await createClient();

  let departmentName: string | null = null;
  if (profile.department_id) {
    const { data } = await supabase
      .from('departments')
      .select('name')
      .eq('id', profile.department_id)
      .maybeSingle();
    departmentName = data?.name ?? null;
  }

  // تتكفّل RLS بقصر التنبيهات على صاحبها — لا حاجة لتصفية بالمعرّف هنا
  const { data: notificationRows } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(15);

  const notifications = (notificationRows ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));

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
          notifications={notifications}
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      {/* مساعد الشركة كنافذة عائمة — يمرّ بنفس مسار التحقق والصلاحيات */}
      <FloatingDock>
        <AssistantWidget companyName={company.name} />
      </FloatingDock>
    </div>
  );
}
