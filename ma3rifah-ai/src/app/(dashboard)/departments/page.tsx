import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/auth/rbac';
import { PageHeader } from '@/components/shared/page-header';
import { DepartmentsClient, type DepartmentRowData } from './departments-client';

export const metadata: Metadata = { title: 'الأقسام' };
export const dynamic = 'force-dynamic';

export default async function DepartmentsPage() {
  const { profile } = await requirePermission('departments.view');
  const supabase = await createClient();

  const [departmentsResult, membersResult] = await Promise.all([
    supabase
      .from('departments')
      .select('id, name, code, description')
      .order('name', { ascending: true }),
    supabase.from('profiles').select('department_id').eq('status', 'ACTIVE'),
  ]);

  const memberCounts = new Map<string, number>();
  for (const member of membersResult.data ?? []) {
    if (!member.department_id) continue;
    memberCounts.set(member.department_id, (memberCounts.get(member.department_id) ?? 0) + 1);
  }

  const departments: DepartmentRowData[] = (departmentsResult.data ?? []).map((department) => ({
    id: department.id,
    name: department.name,
    code: department.code,
    description: department.description,
    memberCount: memberCounts.get(department.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="الأقسام"
        description="تنظيم الموظفين في أقسام يتيح تقييد صلاحيات المستندات ومتابعة استخدام كل قسم."
      />
      <DepartmentsClient
        departments={departments}
        canManage={can(profile.role, 'departments.manage')}
      />
    </div>
  );
}
