import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { reviewCommission } from "@/app/actions/admin";
import { approveDueCommissions } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import {
  COMMISSION_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  formatBps,
  formatDate,
  formatRelativeDays,
} from "@/lib/format";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/stat";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "العمولات", robots: { index: false } };
export const dynamic = "force-dynamic";

const FILTERS = [
  { value: "PENDING", label: "معلّقة" },
  { value: "APPROVED", label: "معتمدة" },
  { value: "PAID", label: "مصروفة" },
  { value: "CANCELLED", label: "ملغاة" },
];

export default async function AdminCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireStaff();
  const { status } = await searchParams;
  const active = status && FILTERS.some((f) => f.value === status) ? status : "PENDING";

  await approveDueCommissions();

  const [commissions, settings] = await Promise.all([
    prisma.commission.findMany({
      where: { status: active as never },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        amount: true,
        baseAmount: true,
        rateBps: true,
        status: true,
        maturesAt: true,
        createdAt: true,
        payoutId: true,
        affiliate: { select: { id: true, code: true, user: { select: { name: true } } } },
        order: {
          select: { id: true, orderNumber: true, status: true, service: { select: { title: true } } },
        },
      },
    }),
    getSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">العمولات</h1>
        <p className="mt-1 text-ink-muted">
          {settings.autoApprove
            ? `الاعتماد تلقائي بعد ${settings.commission.holdDays} يومًا من اكتمال الطلب — وهنا تعتمد يدويًا قبل موعدها أو تُلغي.`
            : "الاعتماد يدوي: لا تُصرف عمولة قبل اعتمادك لها."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/admin/commissions?status=${filter.value}`}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium",
              active === filter.value
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-ink-soft hover:border-brand-line",
            )}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {commissions.length === 0 ? (
        <EmptyState title="لا توجد عمولات بهذه الحالة" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[54rem] text-sm">
            <thead className="border-b border-line bg-surface-soft text-right">
              <tr className="text-xs text-ink-muted">
                <th className="px-4 py-3 font-medium">المسوّق</th>
                <th className="px-4 py-3 font-medium">الطلب</th>
                <th className="px-4 py-3 font-medium">قيمة الطلب</th>
                <th className="px-4 py-3 font-medium">النسبة</th>
                <th className="px-4 py-3 font-medium">العمولة</th>
                <th className="px-4 py-3 font-medium">الاستحقاق</th>
                <th className="px-4 py-3 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((commission) => (
                <tr key={commission.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/affiliates/${commission.affiliate.id}`}
                      className="font-semibold text-brand hover:underline"
                    >
                      {commission.affiliate.user.name}
                    </Link>
                    <span className="block font-mono text-xs text-ink-faint">
                      {commission.affiliate.code}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${commission.order.id}`}
                      className="font-mono text-xs hover:underline"
                    >
                      {commission.order.orderNumber}
                    </Link>
                    <span className="block text-xs text-ink-faint">
                      {commission.order.service.title} ·{" "}
                      {ORDER_STATUS_LABELS[commission.order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular">{formatMoney(commission.baseAmount)}</td>
                  <td className="px-4 py-3 tabular">{formatBps(commission.rateBps)}</td>
                  <td className="px-4 py-3 font-bold text-brand tabular">
                    {formatMoney(commission.amount)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {commission.status === "PENDING" ? (
                      commission.maturesAt ? (
                        formatRelativeDays(commission.maturesAt)
                      ) : (
                        <span className="text-ink-faint">بانتظار اكتمال الطلب</span>
                      )
                    ) : (
                      <Badge tone={STATUS_TONES[commission.status] ?? "neutral"}>
                        {COMMISSION_STATUS_LABELS[commission.status]}
                      </Badge>
                    )}
                    <span className="mt-1 block text-ink-faint">
                      {formatDate(commission.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {commission.status === "PENDING" || commission.status === "APPROVED" ? (
                      <div className="flex gap-2">
                        {commission.status === "PENDING" ? (
                          <form action={reviewCommission}>
                            <input type="hidden" name="commissionId" value={commission.id} />
                            <input type="hidden" name="decision" value="approve" />
                            <Button type="submit" size="sm">
                              اعتماد
                            </Button>
                          </form>
                        ) : null}
                        {commission.payoutId == null ? (
                          <form action={reviewCommission}>
                            <input type="hidden" name="commissionId" value={commission.id} />
                            <input type="hidden" name="decision" value="cancel" />
                            <Button type="submit" size="sm" variant="secondary">
                              إلغاء
                            </Button>
                          </form>
                        ) : (
                          <span className="text-xs text-ink-faint">محجوزة في طلب سحب</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
                    )}
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
