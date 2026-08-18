import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { isMockPaymentsAllowed } from "@/lib/payments";
import { completeMockPayment } from "@/app/actions/checkout";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "الدفع",
  robots: { index: false, follow: false },
};

/**
 * صفحة الدفع التجريبية — بديل بوّابة الدفع أثناء التطوير.
 * في الإنتاج مع مزوّد حقيقي لا يمرّ العميل من هنا إطلاقًا.
 */
export default async function MockCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  if (!isMockPaymentsAllowed()) notFound();

  const [{ orderNumber }, query] = await Promise.all([params, searchParams]);

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      orderNumber: true,
      trackingKey: true,
      status: true,
      subtotal: true,
      discount: true,
      total: true,
      customerName: true,
      service: { select: { title: true } },
      tier: { select: { name: true } },
    },
  });

  if (!order || !query.k || order.trackingKey !== query.k) notFound();
  if (order.status !== "PENDING_PAYMENT") {
    redirect(`/orders/${order.orderNumber}?k=${order.trackingKey}`);
  }

  return (
    <div className="container-page max-w-xl py-16">
      <div className="card p-8">
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs font-semibold text-warning">
          بيئة تجريبية — لا يُخصم أي مبلغ حقيقي.
        </p>

        <h1 className="mt-5 font-display text-2xl font-extrabold">إتمام الدفع</h1>
        <p className="mt-1 text-sm text-ink-muted">
          طلب رقم {order.orderNumber} — {order.service.title} ({order.tier.name})
        </p>

        <dl className="mt-6 space-y-2 border-y border-line py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">الإجمالي</dt>
            <dd className="tabular">{formatMoney(order.subtotal)}</dd>
          </div>
          {order.discount > 0 ? (
            <div className="flex justify-between text-success">
              <dt>الخصم</dt>
              <dd className="tabular">- {formatMoney(order.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between pt-2 text-base font-bold">
            <dt>المطلوب دفعه</dt>
            <dd className="font-display text-brand tabular">{formatMoney(order.total)}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col gap-3">
          <form action={completeMockPayment}>
            <input type="hidden" name="orderNumber" value={order.orderNumber} />
            <input type="hidden" name="trackingKey" value={order.trackingKey} />
            <input type="hidden" name="outcome" value="success" />
            <Button type="submit" size="lg" className="w-full">
              محاكاة دفع ناجح
            </Button>
          </form>

          <form action={completeMockPayment}>
            <input type="hidden" name="orderNumber" value={order.orderNumber} />
            <input type="hidden" name="trackingKey" value={order.trackingKey} />
            <input type="hidden" name="outcome" value="cancel" />
            <Button type="submit" variant="secondary" className="w-full">
              إلغاء الدفع
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
