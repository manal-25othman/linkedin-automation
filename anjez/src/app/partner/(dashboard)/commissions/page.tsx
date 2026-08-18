import type { Metadata } from "next";
import { requireAffiliateUser } from "@/lib/auth/guard";
import { getAffiliateCommissions, getAffiliateProfile } from "@/lib/queries/partner";
import { formatMoney } from "@/lib/money";
import {
  COMMISSION_STATUS_LABELS,
  ATTRIBUTION_LABELS,
  ORDER_STATUS_LABELS,
  formatBps,
  formatDate,
  formatRelativeDays,
} from "@/lib/format";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/stat";

export const metadata: Metadata = { title: "عمولاتي", robots: { index: false } };

export default async function PartnerCommissionsPage() {
  const user = await requireAffiliateUser();
  const profile = await getAffiliateProfile(user.id);
  if (!profile) return null;

  const commissions = await getAffiliateCommissions(profile.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">العمولات</h1>
        <p className="mt-1 text-ink-muted">
          كل عمولة مرتبطة بطلب حقيقي: قيمته، ونسبتك عليه، وحالته.
        </p>
      </div>

      {commissions.length === 0 ? (
        <EmptyState
          title="لا توجد عمولات بعد"
          body="شارك رابطك، وستظهر العمولة هنا فور دفع أول عميل."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b border-line bg-surface-soft text-right">
              <tr className="text-xs text-ink-muted">
                <th className="px-4 py-3 font-medium">الطلب</th>
                <th className="px-4 py-3 font-medium">الخدمة</th>
                <th className="px-4 py-3 font-medium">قيمة الطلب</th>
                <th className="px-4 py-3 font-medium">نسبتك</th>
                <th className="px-4 py-3 font-medium">عمولتك</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((commission) => (
                <tr key={commission.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs">{commission.order.orderNumber}</span>
                    <span className="mt-1 block text-xs text-ink-faint">
                      {ATTRIBUTION_LABELS[commission.order.attribution]} ·{" "}
                      {ORDER_STATUS_LABELS[commission.order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{commission.order.service.title}</td>
                  <td className="px-4 py-3 tabular">{formatMoney(commission.baseAmount)}</td>
                  <td className="px-4 py-3 tabular">{formatBps(commission.rateBps)}</td>
                  <td className="px-4 py-3 font-bold text-brand tabular">
                    {formatMoney(commission.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONES[commission.status] ?? "neutral"}>
                      {COMMISSION_STATUS_LABELS[commission.status]}
                    </Badge>
                    {commission.status === "PENDING" && commission.maturesAt ? (
                      <span className="mt-1 block text-xs text-ink-faint">
                        تُعتمد {formatRelativeDays(commission.maturesAt)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-muted">
                    {formatDate(commission.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
