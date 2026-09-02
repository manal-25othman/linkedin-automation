import type { Metadata } from 'next';
import { MessageSquareHeart } from 'lucide-react';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatNumber, formatRelativeTime } from '@/lib/utils';
import type { FeedbackFoundAnswers, UserRole } from '@/types/database';

export const metadata: Metadata = { title: 'الاستبيان' };
export const dynamic = 'force-dynamic';

const FOUND_LABELS: Record<FeedbackFoundAnswers, string> = {
  MOSTLY: 'غالبًا',
  SOMETIMES: 'أحيانًا',
  RARELY: 'نادرًا',
};

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'مالك المنصة',
  COMPANY_ADMIN: 'مدير شركة',
  MANAGER: 'مدير قسم',
  EMPLOYEE: 'موظف',
};

function average(values: number[]): string {
  if (values.length === 0) return '—';
  return (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1);
}

/**
 * إجابات الاستبيان — لمالك المنصة وحده.
 *
 * تُعرض الشركة والدور لا اسم المستخدم: الرأي يُقرأ بسياقه (من أي شركة
 * وبأي دور) لا بصاحبه. ومن وافق على التواصل يُعلَّم، ويُطلب بريده من
 * صفحة الشركة حين يُراد.
 */
export default async function AdminFeedbackPage() {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const [{ data: rows }, { data: companies }] = await Promise.all([
    admin
      .from('feedback_surveys')
      .select(
        'id, company_id, role, overall_rating, found_answers, recommend_rating, most_useful, missing, allow_contact, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(500),
    admin.from('companies').select('id, name'),
  ]);

  const companyNames = new Map((companies ?? []).map((company) => [company.id, company.name]));
  const surveys = rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="استبيان الرأي"
        description="ما كتبه المستخدمون بعد خمس إجابات من المساعد. يُقرأ كله، ويُرتَّب الأحدث أولًا."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="الإجابات" value={formatNumber(surveys.length)} icon={MessageSquareHeart} />
        <StatCard
          label="متوسط الرضا (من 5)"
          value={average(surveys.map((s) => s.overall_rating))}
          icon={MessageSquareHeart}
        />
        <StatCard
          label="متوسط التوصية (من 5)"
          value={average(surveys.map((s) => s.recommend_rating))}
          icon={MessageSquareHeart}
        />
      </div>

      {surveys.length === 0 ? (
        <EmptyState
          icon={MessageSquareHeart}
          title="لا إجابات بعد"
          description="تظهر الدعوة للمستخدم بعد خمس إجابات فعلية من المساعد. أول إجابة ستظهر هنا."
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الشركة</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>الرضا</TableHead>
                <TableHead>وجد إجابات</TableHead>
                <TableHead>يوصي</TableHead>
                <TableHead>الأكثر فائدة</TableHead>
                <TableHead>الناقص</TableHead>
                <TableHead>تواصل</TableHead>
                <TableHead>متى</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {surveys.map((survey) => (
                <TableRow key={survey.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {companyNames.get(survey.company_id) ?? '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {ROLE_LABELS[survey.role] ?? survey.role}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    <Badge variant={survey.overall_rating >= 4 ? 'success' : survey.overall_rating >= 3 ? 'secondary' : 'warning'}>
                      {survey.overall_rating}/5
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{FOUND_LABELS[survey.found_answers]}</TableCell>
                  <TableCell className="tabular-nums text-sm">{survey.recommend_rating}/5</TableCell>
                  <TableCell className="max-w-xs text-sm leading-relaxed">
                    {survey.most_useful || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="max-w-xs text-sm leading-relaxed">
                    {survey.missing || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {survey.allow_contact ? <Badge variant="success">يوافق</Badge> : '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatRelativeTime(survey.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
