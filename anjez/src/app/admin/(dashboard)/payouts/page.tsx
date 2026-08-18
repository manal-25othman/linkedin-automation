import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { processPayout } from "@/app/actions/admin";
import { formatMoney } from "@/lib/money";
import { PAYOUT_STATUS_LABELS, formatDate, formatNumber } from "@/lib/format";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/stat";

export const metadata: Metadata = { title: "السحوبات", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage() {
  await requireStaff();

  const payouts = await prisma.payout.findMany({
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      amount: true,
      status: true,
      method: true,
      beneficiarySnapshot: true,
      reference: true,
      note: true,
      requestedAt: true,
      processedAt: true,
      affiliate: { select: { id: true, code: true, user: { select: { name: true } } } },
      _count: { select: { commissions: true } },
    },
  });

  const open = payouts.filter((payout) => payout.status === "REQUESTED" || payout.status === "PROCESSING");
  const done = payouts.filter((payout) => payout.status === "PAID" || payout.status === "REJECTED");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold">السحوبات</h1>
        <p className="mt-1 text-ink-muted">
          «تم الصرف» يحوّل العمولات المرتبطة إلى «مصروفة»، و«رفض» يعيدها لرصيد المسوّق.
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">طلبات مفتوحة ({open.length})</h2>

        {open.length === 0 ? (
          <EmptyState title="لا توجد طلبات سحب مفتوحة" />
        ) : (
          <div className="space-y-4">
            {open.map((payout) => (
              <div key={payout.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/admin/affiliates/${payout.affiliate.id}`}
                      className="font-semibold text-brand hover:underline"
                    >
                      {payout.affiliate.user.name}
                    </Link>
                    <p className="text-xs text-ink-faint">
                      كود {payout.affiliate.code} · {formatNumber(payout._count.commissions)} عمولة ·
                      طُلب في {formatDate(payout.requestedAt)}
                    </p>
                    <p className="mt-2 text-sm" dir="ltr">
                      {payout.beneficiarySnapshot ?? "—"}
                    </p>
                  </div>

                  <div className="text-left">
                    <p className="font-display text-2xl font-extrabold text-brand tabular">
                      {formatMoney(payout.amount)}
                    </p>
                    <Badge tone={STATUS_TONES[payout.status] ?? "neutral"}>
                      {PAYOUT_STATUS_LABELS[payout.status]}
                    </Badge>
                  </div>
                </div>

                <form action={processPayout} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_1fr_auto]">
                  <input type="hidden" name="payoutId" value={payout.id} />
                  <input
                    name="reference"
                    className="input-field"
                    placeholder="مرجع التحويل البنكي"
                    aria-label="مرجع التحويل"
                  />
                  <input
                    name="note"
                    className="input-field"
                    placeholder="ملاحظة (اختياري)"
                    aria-label="ملاحظة"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" name="decision" value="paid" size="sm">
                      تم الصرف
                    </Button>
                    <Button type="submit" name="decision" value="processing" size="sm" variant="secondary">
                      قيد التحويل
                    </Button>
                    <Button type="submit" name="decision" value="reject" size="sm" variant="danger">
                      رفض
                    </Button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">السجلّ</h2>
        {done.length === 0 ? (
          <EmptyState title="لا يوجد سجلّ بعد" />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead className="border-b border-line bg-surface-soft text-right">
                <tr className="text-xs text-ink-muted">
                  <th className="px-4 py-3 font-medium">المسوّق</th>
                  <th className="px-4 py-3 font-medium">المبلغ</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">المرجع</th>
                  <th className="px-4 py-3 font-medium">تاريخ المعالجة</th>
                </tr>
              </thead>
              <tbody>
                {done.map((payout) => (
                  <tr key={payout.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">{payout.affiliate.user.name}</td>
                    <td className="px-4 py-3 font-bold tabular">{formatMoney(payout.amount)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONES[payout.status] ?? "neutral"}>
                        {PAYOUT_STATUS_LABELS[payout.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{payout.reference ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {payout.processedAt ? formatDate(payout.processedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
