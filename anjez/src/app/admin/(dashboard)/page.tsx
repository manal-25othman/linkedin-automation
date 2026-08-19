import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guard";
import { getAdminOverview, getTopAffiliates } from "@/lib/queries/admin";
import { approveDueCommissions } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import { formatNumber, AFFILIATE_TIER_LABELS } from "@/lib/format";
import { Stat, EmptyState } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "لوحة الإدارة", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireStaff();

  // اعتماد ما استحقّ من العمولات عند كل فتح للّوحة — حتى لو تعطّلت المهمّة المجدولة.
  const approvedNow = await approveDueCommissions();
  const [overview, topAffiliates] = await Promise.all([getAdminOverview(), getTopAffiliates()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold">المؤشرات</h1>
        <p className="mt-1 text-ink-muted">
          صورة سريعة عن المبيعات والعمولات والمهامّ التي تنتظر قرارك.
        </p>
      </div>

      {(overview.affiliatesPending > 0 || overview.payoutsRequested > 0) && (
        <div className="card border-warning/30 bg-warning-soft p-5">
          <p className="font-semibold text-warning">بانتظار إجراء منك</p>
          <ul className="mt-2 space-y-1 text-sm text-ink-soft">
            {overview.affiliatesPending > 0 ? (
              <li>
                • {formatNumber(overview.affiliatesPending)} طلب انضمام مسوّق —{" "}
                <Link href="/admin/affiliates" className="font-semibold text-brand hover:underline">
                  مراجعة
                </Link>
              </li>
            ) : null}
            {overview.payoutsRequested > 0 ? (
              <li>
                • {formatNumber(overview.payoutsRequested)} طلب سحب —{" "}
                <Link href="/admin/payouts" className="font-semibold text-brand hover:underline">
                  معالجة
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="إيراد الشهر" value={formatMoney(overview.revenueMonth)} tone="brand" />
        <Stat label="الإيراد الكلّي" value={formatMoney(overview.revenue)} />
        <Stat
          label="طلبات الشهر"
          value={formatNumber(overview.ordersMonth)}
          hint={`الإجمالي ${formatNumber(overview.ordersTotal)}`}
        />
        <Stat
          label="طلبات قيد التنفيذ"
          value={formatNumber(overview.pendingOrders)}
          tone="muted"
        />
        <Stat
          label="عمولات معلّقة"
          value={formatMoney(overview.commissionPending)}
          hint={approvedNow > 0 ? `اعتُمدت ${formatNumber(approvedNow)} عمولة الآن` : undefined}
        />
        <Stat
          label="عمولات معتمدة (مستحقّة الصرف)"
          value={formatMoney(overview.commissionApproved)}
          tone="accent"
        />
        <Stat label="مسوّقون مفعّلون" value={formatNumber(overview.affiliatesActive)} />
        <Stat
          label="حصّة المسوّقين من الطلبات"
          value={`${overview.referredShare}٪`}
          tone="success"
        />
      </div>

      <div>
        <h2 className="mb-3 font-display text-lg font-bold">أفضل المسوّقين</h2>
        {topAffiliates.length === 0 ? (
          <EmptyState title="لا توجد عمولات معتمدة بعد" />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="border-b border-line bg-surface-soft text-right">
                <tr className="text-xs text-ink-muted">
                  <th className="px-4 py-3 font-medium">المسوّق</th>
                  <th className="px-4 py-3 font-medium">الكود</th>
                  <th className="px-4 py-3 font-medium">المستوى</th>
                  <th className="px-4 py-3 font-medium">المبيعات</th>
                  <th className="px-4 py-3 font-medium">العمولات</th>
                </tr>
              </thead>
              <tbody>
                {topAffiliates.map((row) => (
                  <tr key={row.affiliate?.id ?? row.commission} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">{row.affiliate?.user.name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.affiliate?.code ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={row.affiliate?.tier === "GOLD" ? "accent" : "neutral"}>
                        {AFFILIATE_TIER_LABELS[row.affiliate?.tier ?? "BRONZE"]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular">{formatMoney(row.sales)}</td>
                    <td className="px-4 py-3 font-bold text-brand tabular">
                      {formatMoney(row.commission)}
                    </td>
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
