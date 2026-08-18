import type { Metadata } from "next";
import { requireAffiliateUser } from "@/lib/auth/guard";
import { getAffiliateProfile } from "@/lib/queries/partner";
import { getSettings } from "@/lib/settings";
import { formatDate, AFFILIATE_TIER_LABELS } from "@/lib/format";
import { formatBps } from "@/lib/format";
import { resolveRateBps } from "@/lib/affiliate/commission";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export const metadata: Metadata = { title: "حسابي", robots: { index: false } };

export default async function PartnerSettingsPage() {
  const user = await requireAffiliateUser();
  const [profile, settings] = await Promise.all([getAffiliateProfile(user.id), getSettings()]);
  if (!profile) return null;

  const rate = resolveRateBps({
    affiliateCustomBps: profile.customBps,
    tier: profile.tier,
    settings: settings.commission,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold">حسابي</h1>
        <p className="mt-1 text-ink-muted">بيانات حسابك وشروط عمولتك.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <p className="font-display text-lg font-bold">بياناتك</p>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              { label: "الاسم", value: profile.user.name },
              { label: "البريد الإلكتروني", value: profile.user.email },
              { label: "كود الإحالة", value: profile.code },
              { label: "المستوى", value: AFFILIATE_TIER_LABELS[profile.tier] },
              {
                label: "نسبتك الافتراضية",
                value: profile.customBps
                  ? `${formatBps(rate)} (نسبة خاصة متّفق عليها)`
                  : formatBps(rate),
              },
              { label: "تاريخ الانضمام", value: formatDate(profile.createdAt) },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4 border-b border-line pb-2 last:border-0">
                <dt className="text-ink-muted">{row.label}</dt>
                <dd className="font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 text-xs text-ink-faint">
            لتعديل الاسم أو البريد أو كود الإحالة تواصل مع الإدارة — الكود يظهر في روابط
            منشورة، وتغييره يُبطل ما نشرته سابقًا.
          </p>
        </div>

        <ChangePasswordForm />
      </div>
    </div>
  );
}
