import type { Metadata } from 'next';
import { requireCompanySession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SessionCard } from '@/components/dashboard/session-card';
import { formatDurationAr, policyFor, tierForRole } from '@/lib/auth/session-policy';
import { ProfileForm } from '../settings-forms';
import { WhatsAppLinkCard } from '@/components/dashboard/whatsapp-link-card';
import { WHATSAPP_NUMBER } from '@/lib/config/contact';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/lib/auth/rbac';

export const metadata: Metadata = { title: 'الملف الشخصي' };
export const dynamic = 'force-dynamic';

export default async function ProfileSettingsPage() {
  const { profile } = await requireCompanySession();

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

  // تتكفّل RLS بقصر الصف على صاحبه
  const { data: whatsappLink } = await supabase
    .from('whatsapp_links')
    .select('phone, verified_at')
    .eq('user_id', profile.id)
    .maybeSingle();

  const sessionPolicy = policyFor(tierForRole(profile.role));
  const idleLabel = formatDurationAr(sessionPolicy.idleMs);
  const absoluteLabel = formatDurationAr(sessionPolicy.absoluteMs);

  return (
    <div className="space-y-6">
      <PageHeader title="الملف الشخصي" description="بياناتك الظاهرة لبقية أعضاء الفريق." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>البيانات الأساسية</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm
              fullName={profile.full_name}
              jobTitle={profile.job_title}
              email={profile.email}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>واتساب</CardTitle>
          </CardHeader>
          <CardContent>
            <WhatsAppLinkCard
              businessNumber={WHATSAPP_NUMBER}
              linkedPhone={whatsappLink?.verified_at ? whatsappLink.phone : null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>صلاحياتك</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">الدور</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge>{ROLE_LABELS[profile.role]}</Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {ROLE_DESCRIPTIONS[profile.role]}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">القسم</p>
              <p className="mt-1.5 text-sm font-medium">{departmentName ?? 'غير محدد'}</p>
            </div>

            <p className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              تغيير الدور أو القسم يتم عبر مدير الشركة من صفحة المستخدمين.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>أمان الجلسة</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionCard idleLabel={idleLabel} absoluteLabel={absoluteLabel} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
