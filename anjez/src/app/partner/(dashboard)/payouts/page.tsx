import type { Metadata } from "next";
import { requireAffiliateUser } from "@/lib/auth/guard";
import {
  getAffiliatePayouts,
  getAffiliateProfile,
  getAffiliateStats,
} from "@/lib/queries/partner";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { PAYOUT_STATUS_LABELS, formatDate, formatNumber } from "@/lib/format";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/stat";
import { PayoutDetailsForm, RequestPayoutForm } from "@/components/affiliate/payout-forms";

export const metadata: Metadata = { title: "السحوبات", robots: { index: false } };

export default async function PartnerPayoutsPage() {
  const user = await requireAffiliateUser();
  const profile = await getAffiliateProfile(user.id);
  if (!profile) return null;

  const [stats, payouts, settings] = await Promise.all([
    getAffiliateStats(profile.id),
    getAffiliatePayouts(profile.id),
    getSettings(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold">السحوبات</h1>
        <p className="mt-1 text-ink-muted">
          اسحب رصيدك المعتمد على حسابك البنكي. العمولات المرتبطة بطلب سحب قائم تُحجز حتى
          يكتمل التحويل.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RequestPayoutForm
          available={stats.balances.available}
          minPayout={settings.commission.minPayout}
          canRequest={stats.balances.available >= settings.commission.minPayout}
        />
        <PayoutDetailsForm
          defaults={{
            payoutMethod: profile.payoutMethod,
            beneficiaryName: profile.beneficiaryName,
            iban: profile.iban,
            bankName: profile.bankName,
          }}
        />
      </div>

      <div>
        <h2 className="mb-3 font-display text-lg font-bold">سجلّ السحوبات</h2>
        {payouts.length === 0 ? (
          <EmptyState title="لا توجد طلبات سحب بعد" />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="border-b border-line bg-surface-soft text-right">
                <tr className="text-xs text-ink-muted">
                  <th className="px-4 py-3 font-medium">المبلغ</th>
                  <th className="px-4 py-3 font-medium">عدد العمولات</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">تاريخ الطلب</th>
                  <th className="px-4 py-3 font-medium">المرجع</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-bold tabular">{formatMoney(payout.amount)}</td>
                    <td className="px-4 py-3 tabular">{formatNumber(payout._count.commissions)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONES[payout.status] ?? "neutral"}>
                        {PAYOUT_STATUS_LABELS[payout.status]}
                      </Badge>
                      {payout.note ? (
                        <span className="mt-1 block text-xs text-ink-faint">{payout.note}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {formatDate(payout.requestedAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{payout.reference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
