import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/auth/rbac';
import { PageHeader } from '@/components/shared/page-header';
import { UsersClient, type UserRowData } from './users-client';

export const metadata: Metadata = { title: 'المستخدمون' };
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const { profile } = await requirePermission('users.view');
  const supabase = await createClient();

  const [usersResult, departmentsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, job_title, role, status, department_id, created_at')
      .order('created_at', { ascending: true }),
    supabase.from('departments').select('id, name').order('name'),
  ]);

  const departments = departmentsResult.data ?? [];
  const departmentNames = new Map(
    departments.map((department) => [department.id, department.name]),
  );

  const users: UserRowData[] = (usersResult.data ?? []).map((user) => ({
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    jobTitle: user.job_title,
    role: user.role,
    status: user.status,
    departmentId: user.department_id,
    departmentName: user.department_id
      ? departmentNames.get(user.department_id) ?? null
      : null,
    createdAt: user.created_at,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="المستخدمون"
        description="أضف أعضاء فريقك وحدّد دور كل منهم والقسم الذي ينتمي إليه."
      />
      <UsersClient
        users={users}
        departments={departments}
        canManage={can(profile.role, 'users.manage')}
        currentUserId={profile.id}
      />
    </div>
  );
}
