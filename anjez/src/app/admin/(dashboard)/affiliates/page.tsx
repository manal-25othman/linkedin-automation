import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { setAffiliateStatus } from "@/app/actions/admin";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/stat";
import { AFFILIATE_STATUS_LABELS, AFFILIATE_TIER_LABELS, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "المسوّقون", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminAffiliatesPage() {
  await requireStaff();

  const affiliates = await prisma.affiliate.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      code: true,
      status: true,
      tier: true,
      promotionPlan: true,
      createdAt: true,
      user: { select: { name: true, email: true, phone: true } },
      _count: { select: { orders: true, clicks: true } },
    },
  });

  const pending = affiliates.filter((affiliate) => affiliate.status === "PENDING");
  const rest = affiliates.filter((affiliate) => affiliate.status !== "PENDING");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold">المسوّقون</h1>
        <p className="mt-1 text-ink-muted">
          راجع خطة التسويق قبل الاعتماد — الحساب المفعّل يبدأ كسب العمولة فورًا.
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">
          بانتظار الاعتماد ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <EmptyState title="لا توجد طلبات انضمام جديدة" />
        ) : (
          <div className="space-y-3">
            {pending.map((affiliate) => (
              <div key={affiliate.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{affiliate.user.name}</p>
                    <p className="text-xs text-ink-muted" dir="ltr">
                      {affiliate.user.email} · {affiliate.user.phone}
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">
                      الكود <span className="font-mono">{affiliate.code}</span> ·{" "}
                      {formatDate(affiliate.createdAt)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <form action={setAffiliateStatus}>
                      <input type="hidden" name="affiliateId" value={affiliate.id} />
                      <input type="hidden" name="status" value="ACTIVE" />
                      <Button type="submit" size="sm">
                        اعتماد
                      </Button>
                    </form>
                    <form action={setAffiliateStatus}>
                      <input type="hidden" name="affiliateId" value={affiliate.id} />
                      <input type="hidden" name="status" value="REJECTED" />
                      <Button type="submit" size="sm" variant="secondary">
                        رفض
                      </Button>
                    </form>
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-line rounded-xl bg-surface-soft p-4 text-sm text-ink-soft">
                  {affiliate.promotionPlan}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">كل المسوّقين</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="border-b border-line bg-surface-soft text-right">
              <tr className="text-xs text-ink-muted">
                <th className="px-4 py-3 font-medium">المسوّق</th>
                <th className="px-4 py-3 font-medium">الكود</th>
                <th className="px-4 py-3 font-medium">المستوى</th>
                <th className="px-4 py-3 font-medium">النقرات</th>
                <th className="px-4 py-3 font-medium">الطلبات</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((affiliate) => (
                <tr key={affiliate.id} className="border-b border-line last:border-0 hover:bg-surface-soft">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/affiliates/${affiliate.id}`}
                      className="font-semibold text-brand hover:underline"
                    >
                      {affiliate.user.name}
                    </Link>
                    <span className="block text-xs text-ink-faint" dir="ltr">
                      {affiliate.user.email}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{affiliate.code}</td>
                  <td className="px-4 py-3">{AFFILIATE_TIER_LABELS[affiliate.tier]}</td>
                  <td className="px-4 py-3 tabular">{affiliate._count.clicks}</td>
                  <td className="px-4 py-3 tabular">{affiliate._count.orders}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONES[affiliate.status] ?? "neutral"}>
                      {AFFILIATE_STATUS_LABELS[affiliate.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
