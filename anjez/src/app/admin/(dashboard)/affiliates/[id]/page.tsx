import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { setAffiliateRate, setAffiliateStatus } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/action-form";
import { getAffiliateStats } from "@/lib/queries/partner";
import { getSettings } from "@/lib/settings";
import { resolveRateBps } from "@/lib/affiliate/commission";
import { formatMoney } from "@/lib/money";
import {
  AFFILIATE_STATUS_LABELS,
  AFFILIATE_TIER_LABELS,
  COMMISSION_STATUS_LABELS,
  formatBps,
  formatDate,
  formatNumber,
} from "@/lib/format";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";

export const metadata: Metadata = { title: "ملفّ المسوّق", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminAffiliatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const affiliate = await prisma.affiliate.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      status: true,
      tier: true,
      customBps: true,
      promotionPlan: true,
      payoutMethod: true,
      beneficiaryName: true,
      iban: true,
      bankName: true,
      createdAt: true,
      approvedAt: true,
      user: { select: { name: true, email: true, phone: true } },
      commissions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          amount: true,
          rateBps: true,
          status: true,
          createdAt: true,
          order: { select: { orderNumber: true, service: { select: { title: true } } } },
        },
      },
    },
  });

  if (!affiliate) notFound();

  const [stats, settings] = await Promise.all([getAffiliateStats(affiliate.id), getSettings()]);

  const effectiveRate = resolveRateBps({
    affiliateCustomBps: affiliate.customBps,
    tier: affiliate.tier,
    settings: settings.commission,
  });

  return (
    <div className="space-y-6">
      <Link href="/admin/affiliates" className="text-sm text-brand hover:underline">
        ← كل المسوّقين
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold">{affiliate.user.name}</h1>
          <p className="text-sm text-ink-muted" dir="ltr">
            {affiliate.user.email} · {affiliate.user.phone}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONES[affiliate.status] ?? "neutral"}>
            {AFFILIATE_STATUS_LABELS[affiliate.status]}
          </Badge>
          <Badge tone={affiliate.tier === "GOLD" ? "gold" : "neutral"}>
            {AFFILIATE_TIER_LABELS[affiliate.tier]}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="النقرات" value={formatNumber(stats.clicks)} />
        <Stat label="طلبات مدفوعة" value={formatNumber(stats.paidOrders)} tone="brand" />
        <Stat label="رصيد قابل للسحب" value={formatMoney(stats.balances.available)} tone="success" />
        <Stat label="مصروف سابقًا" value={formatMoney(stats.balances.paid)} tone="muted" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <p className="font-display text-lg font-bold">إدارة الحساب</p>

          <p className="mt-3 text-sm text-ink-muted">
            النسبة السارية الآن: <span className="font-bold text-brand">{formatBps(effectiveRate)}</span>
            {affiliate.customBps != null ? " (نسبة خاصة)" : " (نسبة عامة + مكافأة المستوى)"}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["ACTIVE", "SUSPENDED", "REJECTED"] as const)
              .filter((status) => status !== affiliate.status)
              .map((status) => (
                <form key={status} action={setAffiliateStatus}>
                  <input type="hidden" name="affiliateId" value={affiliate.id} />
                  <input type="hidden" name="status" value={status} />
                  <Button
                    type="submit"
                    size="sm"
                    variant={status === "ACTIVE" ? "primary" : "secondary"}
                  >
                    {status === "ACTIVE" ? "تفعيل" : status === "SUSPENDED" ? "إيقاف" : "رفض"}
                  </Button>
                </form>
              ))}
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <ActionForm action={setAffiliateRate} submitLabel="حفظ النسبة الخاصة">
              <input type="hidden" name="affiliateId" value={affiliate.id} />
              <label className="label-field" htmlFor="customPercent">
                نسبة خاصة ٪ (اتركها فارغة للنسبة العامة)
              </label>
              <input
                id="customPercent"
                name="customPercent"
                className="input-field"
                defaultValue={affiliate.customBps != null ? affiliate.customBps / 100 : ""}
                placeholder="مثال: 25"
              />
            </ActionForm>
          </div>
        </div>

        <div className="card p-6">
          <p className="font-display text-lg font-bold">بيانات الصرف والخطة</p>
          <dl className="mt-4 space-y-2 text-sm">
            {[
              { label: "وسيلة الصرف", value: affiliate.payoutMethod ?? "—" },
              { label: "اسم المستفيد", value: affiliate.beneficiaryName ?? "—" },
              { label: "الآيبان", value: affiliate.iban ?? "—" },
              { label: "البنك", value: affiliate.bankName || "—" },
              { label: "تاريخ التسجيل", value: formatDate(affiliate.createdAt) },
              {
                label: "تاريخ الاعتماد",
                value: affiliate.approvedAt ? formatDate(affiliate.approvedAt) : "—",
              },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4 border-b border-line pb-2 last:border-0">
                <dt className="text-ink-muted">{row.label}</dt>
                <dd className="font-medium" dir={row.label === "الآيبان" ? "ltr" : undefined}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 whitespace-pre-line rounded-xl bg-surface-soft p-4 text-sm text-ink-soft">
            {affiliate.promotionPlan}
          </p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="border-b border-line bg-surface-soft text-right">
            <tr className="text-xs text-ink-muted">
              <th className="px-4 py-3 font-medium">الطلب</th>
              <th className="px-4 py-3 font-medium">الخدمة</th>
              <th className="px-4 py-3 font-medium">النسبة</th>
              <th className="px-4 py-3 font-medium">العمولة</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {affiliate.commissions.map((commission) => (
              <tr key={commission.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{commission.order.orderNumber}</td>
                <td className="px-4 py-3">{commission.order.service.title}</td>
                <td className="px-4 py-3 tabular">{formatBps(commission.rateBps)}</td>
                <td className="px-4 py-3 font-bold tabular">{formatMoney(commission.amount)}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONES[commission.status] ?? "neutral"}>
                    {COMMISSION_STATUS_LABELS[commission.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-ink-muted">
                  {formatDate(commission.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
