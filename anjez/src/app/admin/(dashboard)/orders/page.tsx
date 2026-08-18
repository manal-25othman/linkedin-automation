import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guard";
import { listOrders } from "@/lib/queries/admin";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS, ATTRIBUTION_LABELS, formatDateTime } from "@/lib/format";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/stat";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "الطلبات", robots: { index: false } };
export const dynamic = "force-dynamic";

const FILTERS = [
  { value: "", label: "الكل" },
  { value: "PENDING_PAYMENT", label: "بانتظار الدفع" },
  { value: "PAID", label: "مدفوع" },
  { value: "IN_PROGRESS", label: "قيد التنفيذ" },
  { value: "DELIVERED", label: "تم التسليم" },
  { value: "COMPLETED", label: "مكتمل" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireStaff();
  const { status } = await searchParams;
  const orders = await listOrders(status || undefined);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">الطلبات</h1>
        <p className="mt-1 text-ink-muted">آخر ١٠٠ طلب. اضغط على الطلب لتغيير حالته.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value || "all"}
            href={filter.value ? `/admin/orders?status=${filter.value}` : "/admin/orders"}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium",
              (status ?? "") === filter.value
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-ink-soft hover:border-brand-line",
            )}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState title="لا توجد طلبات بهذه الحالة" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-line bg-surface-soft text-right">
              <tr className="text-xs text-ink-muted">
                <th className="px-4 py-3 font-medium">الطلب</th>
                <th className="px-4 py-3 font-medium">العميل</th>
                <th className="px-4 py-3 font-medium">الخدمة</th>
                <th className="px-4 py-3 font-medium">المبلغ</th>
                <th className="px-4 py-3 font-medium">المصدر</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-line last:border-0 hover:bg-surface-soft">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-mono text-xs font-bold text-brand hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {order.customerName}
                    <span className="block text-xs text-ink-faint" dir="ltr">
                      {order.customerPhone}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {order.service.title}
                    <span className="block text-xs text-ink-faint">{order.tier.name}</span>
                  </td>
                  <td className="px-4 py-3 tabular">{formatMoney(order.total)}</td>
                  <td className="px-4 py-3 text-xs">
                    {ATTRIBUTION_LABELS[order.attribution]}
                    {order.affiliate ? (
                      <span className="block font-mono text-ink-faint">{order.affiliate.code}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONES[order.status] ?? "neutral"}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-muted">
                    {formatDateTime(order.createdAt)}
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
