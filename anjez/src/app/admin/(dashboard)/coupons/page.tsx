import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { saveCoupon, toggleCoupon } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/stat";
import { formatMoney } from "@/lib/money";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "أكواد الخصم", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  await requireStaff();

  const [coupons, affiliates] = await Promise.all([
    prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        type: true,
        value: true,
        usedCount: true,
        maxUses: true,
        expiresAt: true,
        isActive: true,
        affiliate: { select: { code: true, user: { select: { name: true } } } },
        _count: { select: { orders: true } },
      },
    }),
    prisma.affiliate.findMany({
      where: { status: "ACTIVE" },
      orderBy: { code: "asc" },
      select: { id: true, code: true, user: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">أكواد الخصم</h1>
        <p className="mt-1 text-ink-muted">
          الكود المرتبط بمسوّق ينسب البيع له حتى لو دخل العميل مباشرة بلا رابط.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <div className="card p-6">
          <p className="mb-4 font-display text-lg font-bold">كود جديد</p>
          <ActionForm action={saveCoupon} submitLabel="إنشاء الكود">
            <div>
              <label className="label-field" htmlFor="code">الكود</label>
              <input
                id="code"
                name="code"
                className="input-field font-mono uppercase"
                dir="ltr"
                required
              />
            </div>

            <div>
              <label className="label-field" htmlFor="affiliateId">مرتبط بمسوّق (اختياري)</label>
              <select id="affiliateId" name="affiliateId" className="input-field" defaultValue="">
                <option value="">بلا مسوّق — خصم عام</option>
                {affiliates.map((affiliate) => (
                  <option key={affiliate.id} value={affiliate.id}>
                    {affiliate.user.name} ({affiliate.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-field" htmlFor="type">نوع الخصم</label>
                <select id="type" name="type" className="input-field">
                  <option value="PERCENT">نسبة ٪</option>
                  <option value="FIXED">مبلغ ثابت</option>
                </select>
              </div>
              <div>
                <label className="label-field" htmlFor="value">القيمة</label>
                <input id="value" name="value" className="input-field" placeholder="10" required />
              </div>
              <div>
                <label className="label-field" htmlFor="maxUses">حد الاستخدام</label>
                <input id="maxUses" name="maxUses" type="number" min={1} className="input-field" />
              </div>
              <div>
                <label className="label-field" htmlFor="expiresAt">تاريخ الانتهاء</label>
                <input id="expiresAt" name="expiresAt" type="date" className="input-field" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked className="accent-brand" />
              مفعّل
            </label>
          </ActionForm>
        </div>

        <div>
          {coupons.length === 0 ? (
            <EmptyState title="لا توجد أكواد بعد" />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[38rem] text-sm">
                <thead className="border-b border-line bg-surface-soft text-right">
                  <tr className="text-xs text-ink-muted">
                    <th className="px-4 py-3 font-medium">الكود</th>
                    <th className="px-4 py-3 font-medium">الخصم</th>
                    <th className="px-4 py-3 font-medium">المسوّق</th>
                    <th className="px-4 py-3 font-medium">الاستخدام</th>
                    <th className="px-4 py-3 font-medium">الحالة</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((coupon) => (
                    <tr key={coupon.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-mono font-bold">{coupon.code}</td>
                      <td className="px-4 py-3">
                        {coupon.type === "PERCENT"
                          ? `${coupon.value / 100}٪`
                          : formatMoney(coupon.value)}
                        {coupon.expiresAt ? (
                          <span className="block text-xs text-ink-faint">
                            ينتهي {formatDate(coupon.expiresAt)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {coupon.affiliate
                          ? `${coupon.affiliate.user.name} (${coupon.affiliate.code})`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 tabular">
                        {formatNumber(coupon.usedCount)}
                        {coupon.maxUses ? ` / ${formatNumber(coupon.maxUses)}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={coupon.isActive ? "success" : "neutral"}>
                          {coupon.isActive ? "مفعّل" : "موقوف"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <form action={toggleCoupon}>
                          <input type="hidden" name="couponId" value={coupon.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            {coupon.isActive ? "إيقاف" : "تفعيل"}
                          </Button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
