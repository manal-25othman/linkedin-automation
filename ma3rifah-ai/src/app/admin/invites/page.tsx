import type { Metadata } from 'next';
import { KeyRound, ShieldCheck, TriangleAlert } from 'lucide-react';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { registrationMode } from '@/lib/auth/invite';
import { PageHeader } from '@/components/shared/page-header';
import { InvitesClient } from './invites-client';
import { logger } from '@/lib/logger';

export const metadata: Metadata = { title: 'الدعوات' };
export const dynamic = 'force-dynamic';

export default async function AdminInvitesPage() {
  await requireSuperAdmin();

  const sessionClient = await createClient();
  const { data, error } = await sessionClient.rpc('invite_codes_report');

  if (error) {
    logger.warn('تعذّر قراءة الدعوات', { reason: error.message });
  }

  const mode = registrationMode();
  const invites = data ?? [];
  const active = invites.filter((invite) => invite.is_active);

  return (
    <div className="space-y-8">
      <PageHeader
        title="الدعوات"
        description="التسجيل بدعوة في مرحلة التجربة — فلا يُنشئ حسابًا إلا من دُعي."
      />

      {mode === 'open' ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div className="text-sm leading-relaxed">
            <strong>التسجيل مفتوح للجميع الآن.</strong> الرموز أدناه لا أثر لها ما دام{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">REGISTRATION_MODE=open</code>.
            احذفي المتغيّر أو اجعليه{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">invite</code> ليُغلق الباب.
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 p-4">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[hsl(var(--success))]" aria-hidden />
          <p className="text-sm leading-relaxed">
            <strong>التسجيل بدعوة.</strong> من يفتح <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/register</code>{' '}
            بلا رمز صالح لا يستطيع إنشاء حساب — ولو وصله الرابط.
            {active.length > 0 ? (
              <>
                {' '}
                <span className="numeric font-semibold">{active.length}</span> رمزًا فعّالًا الآن.
              </>
            ) : null}
          </p>
        </div>
      )}

      <InvitesClient invites={invites} />

      <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-sm leading-relaxed text-muted-foreground">
          الرمز يُلغى ولا يُحذف: الحذف يمحو أثر الحسابات التي أُنشئت به، فيضيع
          الجواب عن «من أين جاء هذا الحساب؟». والإلغاء يوقفه فورًا ويُبقي السجلّ.
        </p>
      </div>
    </div>
  );
}
