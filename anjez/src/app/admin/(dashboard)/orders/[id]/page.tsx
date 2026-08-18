import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { changeOrderStatus } from "@/app/actions/admin";
import { canTransition } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import {
  ORDER_STATUS_LABELS,
  ATTRIBUTION_LABELS,
  COMMISSION_STATUS_LABELS,
  formatBps,
  formatDateTime,
} from "@/lib/format";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@prisma/client";

export const metadata: Metadata = { title: "تفاصيل الطلب", robots: { index: false } };
export const dynamic = "force-dynamic";

const ALL_STATUSES: OrderStatus[] = [
  "PAID",
  "IN_PROGRESS",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
];

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      notes: true,
      subtotal: true,
      discount: true,
      total: true,
      attribution: true,
      paymentProvider: true,
      paymentReference: true,
      createdAt: true,
      paidAt: true,
      service: { select: { title: true } },
      tier: { select: { name: true, deliveryDays: true } },
      coupon: { select: { code: true } },
      affiliate: { select: { id: true, code: true, user: { select: { name: true } } } },
      commission: {
        select: { amount: true, rateBps: true, status: true, maturesAt: true },
      },
      events: {
        orderBy: { createdAt: "desc" },
        select: { id: true, from: true, to: true, actor: true, note: true, createdAt: true },
      },
    },
  });

  if (!order) notFound();

  const nextStatuses = ALL_STATUSES.filter((status) =>
    canTransition(order.status, status),
  );

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="text-sm text-brand hover:underline">
        ← كل الطلبات
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tabular">{order.orderNumber}</h1>
          <p className="text-sm text-ink-muted">{formatDateTime(order.createdAt)}</p>
        </div>
        <Badge tone={STATUS_TONES[order.status] ?? "neutral"}>
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="card p-6">
            <p className="font-display text-lg font-bold">الطلب</p>
            <dl className="mt-4 space-y-2 text-sm">
              {[
                { label: "الخدمة", value: order.service.title },
                { label: "الباقة", value: `${order.tier.name} — ${order.tier.deliveryDays} أيام` },
                { label: "العميل", value: order.customerName },
                { label: "الجوال", value: order.customerPhone },
                { label: "البريد", value: order.customerEmail ?? "—" },
                { label: "الإجمالي", value: formatMoney(order.subtotal) },
                {
                  label: "الخصم",
                  value: order.discount > 0 ? `${formatMoney(order.discount)} (${order.coupon?.code ?? "—"})` : "—",
                },
                { label: "المدفوع", value: formatMoney(order.total) },
                {
                  label: "الدفع",
                  value: order.paidAt
                    ? `${order.paymentProvider ?? ""} · ${order.paymentReference ?? ""}`
                    : "لم يُدفع بعد",
                },
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-4 border-b border-line pb-2 last:border-0">
                  <dt className="text-ink-muted">{row.label}</dt>
                  <dd className="font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>

            {order.notes ? (
              <div className="mt-4 rounded-xl bg-surface-soft p-4 text-sm">
                <p className="mb-1 font-semibold">ملاحظات العميل</p>
                <p className="whitespace-pre-line text-ink-soft">{order.notes}</p>
              </div>
            ) : null}
          </div>

          <div className="card p-6">
            <p className="font-display text-lg font-bold">سجلّ الحالات</p>
            <ul className="mt-4 space-y-3 text-sm">
              {order.events.map((event) => (
                <li key={event.id} className="flex justify-between gap-4 border-b border-line pb-2 last:border-0">
                  <span>
                    {event.from ? `${ORDER_STATUS_LABELS[event.from] ?? event.from} ← ` : ""}
                    <span className="font-semibold">
                      {ORDER_STATUS_LABELS[event.to] ?? event.to}
                    </span>
                    <span className="block text-xs text-ink-faint">
                      {event.actor}
                      {event.note ? ` — ${event.note}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {formatDateTime(event.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <p className="font-display text-lg font-bold">تغيير الحالة</p>
            {nextStatuses.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">
                هذه حالة نهائية، ولا انتقال منها.
              </p>
            ) : (
              <form action={changeOrderStatus} className="mt-4 space-y-3">
                <input type="hidden" name="orderId" value={order.id} />

                <label className="label-field" htmlFor="status">
                  الحالة الجديدة
                </label>
                <select id="status" name="status" className="input-field">
                  {nextStatuses.map((status) => (
                    <option key={status} value={status}>
                      {ORDER_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>

                <label className="label-field" htmlFor="note">
                  ملاحظة (اختياري)
                </label>
                <input id="note" name="note" className="input-field" />

                <Button type="submit" className="w-full">
                  تحديث الحالة
                </Button>
                <p className="text-xs text-ink-faint">
                  «مكتمل» يبدأ عدّاد تثبيت العمولة، و«ملغى/مسترجع» يُلغي العمولة غير المصروفة.
                </p>
              </form>
            )}
          </div>

          <div className="card p-6">
            <p className="font-display text-lg font-bold">الإحالة</p>
            <p className="mt-3 text-sm text-ink-muted">
              المصدر: {ATTRIBUTION_LABELS[order.attribution]}
            </p>

            {order.affiliate ? (
              <p className="mt-2 text-sm">
                المسوّق:{" "}
                <Link
                  href={`/admin/affiliates/${order.affiliate.id}`}
                  className="font-semibold text-brand hover:underline"
                >
                  {order.affiliate.user.name} ({order.affiliate.code})
                </Link>
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink-faint">طلب مباشر بلا مسوّق.</p>
            )}

            {order.commission ? (
              <div className="mt-4 rounded-xl bg-surface-soft p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">العمولة</span>
                  <Badge tone={STATUS_TONES[order.commission.status] ?? "neutral"}>
                    {COMMISSION_STATUS_LABELS[order.commission.status]}
                  </Badge>
                </div>
                <p className="mt-2 font-display text-xl font-extrabold text-brand tabular">
                  {formatMoney(order.commission.amount)}
                </p>
                <p className="text-xs text-ink-faint">
                  بنسبة {formatBps(order.commission.rateBps)}
                  {order.commission.maturesAt
                    ? ` — تُعتمد في ${formatDateTime(order.commission.maturesAt)}`
                    : ""}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
