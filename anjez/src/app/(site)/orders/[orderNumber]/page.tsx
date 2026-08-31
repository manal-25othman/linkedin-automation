import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS, formatDateTime } from "@/lib/format";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { retryPayment } from "@/app/actions/checkout";
import { getSettings } from "@/lib/settings";
import { activeProviderName } from "@/lib/payments";

export const metadata: Metadata = {
  title: "تفاصيل الطلب",
  robots: { index: false, follow: false },
};

const TIMELINE = ["PENDING_PAYMENT", "PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] as const;

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ k?: string; payment?: string }>;
}) {
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
      notes: true,
      createdAt: true,
      paidAt: true,
      customerName: true,
      service: { select: { title: true, slug: true, requirements: true } },
      tier: { select: { name: true, deliveryDays: true } },
      events: { orderBy: { createdAt: "asc" }, select: { to: true, createdAt: true } },
    },
  });

  // الرابط وحده لا يكفي: لا بدّ من مفتاح المتابعة، وإلا لأمكن تصفّح طلبات
  // الآخرين بتجربة أرقام.
  if (!order || !query.k || order.trackingKey !== query.k) notFound();

  const settings = await getSettings();
  const isManualPayment = activeProviderName() === "manual" || query.payment === "manual";

  const currentIndex = TIMELINE.indexOf(order.status as (typeof TIMELINE)[number]);
  const isClosed = order.status === "CANCELLED" || order.status === "REFUNDED";

  return (
    <div className="container-page max-w-3xl py-12">
      {query.payment === "failed" ? (
        <p className="mb-6 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          تعذّر فتح صفحة الدفع. طلبك محفوظ — أعد المحاولة من الزر أدناه.
        </p>
      ) : null}

      <div className="card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-ink-muted">طلب رقم</p>
            <p className="font-display text-2xl font-extrabold tabular">{order.orderNumber}</p>
            <p className="mt-1 text-sm text-ink-muted">
              أُنشئ في {formatDateTime(order.createdAt)}
            </p>
          </div>
          <Badge tone={STATUS_TONES[order.status] ?? "neutral"}>
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        </div>

        <div className="mt-6 border-t border-line pt-6">
          <p className="font-display text-lg font-bold">{order.service.title}</p>
          <p className="text-sm text-ink-muted">
            باقة {order.tier.name} — التسليم خلال {order.tier.deliveryDays} أيام عمل
          </p>
        </div>

        {!isClosed ? (
          <ol className="mt-6 grid gap-3 border-t border-line pt-6 sm:grid-cols-5">
            {TIMELINE.map((step, index) => (
              <li key={step} className="flex items-center gap-2 sm:flex-col sm:text-center">
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                    index <= currentIndex
                      ? "bg-brand text-white"
                      : "bg-surface-soft text-ink-faint"
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  className={`text-xs ${index <= currentIndex ? "font-semibold text-ink" : "text-ink-faint"}`}
                >
                  {ORDER_STATUS_LABELS[step]}
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        <dl className="mt-6 space-y-2 border-t border-line pt-6 text-sm">
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
          <div className="flex justify-between text-base font-bold">
            <dt>المدفوع</dt>
            <dd className="font-display text-brand tabular">{formatMoney(order.total)}</dd>
          </div>
        </dl>

        {order.status === "PENDING_PAYMENT" && isManualPayment ? (
          <div className="mt-6 rounded-2xl border border-accent-line bg-accent-soft p-5">
            <p className="font-display text-lg font-bold">أكمل الدفع بالتحويل البنكي</p>
            <p className="mt-1 text-sm text-ink-soft">
              حوّل مبلغ {formatMoney(order.total)} إلى الحساب أدناه، ثم أرسل صورة الإيصال
              على واتساب مع رقم طلبك — نبدأ التنفيذ فور تأكيد الاستلام.
            </p>

            <dl className="mt-4 space-y-2 rounded-xl bg-surface p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">اسم المستفيد</dt>
                <dd className="font-bold">{settings.bankTransfer.beneficiary || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">الآيبان</dt>
                <dd className="font-mono font-bold" dir="ltr">
                  {settings.bankTransfer.iban || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">البنك</dt>
                <dd className="font-bold">{settings.bankTransfer.bankName || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-2">
                <dt className="text-ink-muted">اكتب في التحويل</dt>
                <dd className="font-mono font-bold">{order.orderNumber}</dd>
              </div>
            </dl>

            {settings.contactWhatsapp ? (
              <a
                href={`https://wa.me/${settings.contactWhatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                  `مرحبًا، أرفقت إيصال التحويل لطلب رقم ${order.orderNumber}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-brand px-6 py-3 font-bold text-white"
              >
                أرسل الإيصال على واتساب
              </a>
            ) : null}
          </div>
        ) : null}

        {order.status === "PENDING_PAYMENT" && !isManualPayment ? (
          <form action={retryPayment} className="mt-6">
            <input type="hidden" name="orderNumber" value={order.orderNumber} />
            <input type="hidden" name="trackingKey" value={order.trackingKey} />
            <Button type="submit" size="lg" className="w-full">
              إتمام الدفع الآن
            </Button>
          </form>
        ) : null}

        {order.paidAt && order.service.requirements ? (
          <div className="mt-6 rounded-xl bg-surface-soft p-5">
            <p className="font-semibold">الخطوة التالية</p>
            <p className="mt-1 text-sm text-ink-muted">
              أرسل لنا المتطلبات التالية على واتساب مرفقًا رقم طلبك:
            </p>
            <ul className="mt-3 space-y-1 text-sm text-ink-soft">
              {order.service.requirements
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => (
                  <li key={line}>• {line}</li>
                ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 border-t border-line pt-4 text-sm">
          <p className="text-ink-muted">
            احفظ هذا الرابط لمتابعة طلبك، أو استخدم{" "}
            <Link href="/track" className="text-brand hover:underline">
              صفحة تتبّع الطلب
            </Link>{" "}
            برقم الطلب وجوالك.
          </p>
        </div>
      </div>

      {order.events.length > 0 ? (
        <div className="card mt-6 p-6">
          <p className="font-display font-bold">سجلّ الطلب</p>
          <ul className="mt-4 space-y-2 text-sm">
            {order.events.map((event, index) => (
              <li key={index} className="flex justify-between gap-4 text-ink-soft">
                <span>{ORDER_STATUS_LABELS[event.to] ?? event.to}</span>
                <span className="text-ink-faint tabular">{formatDateTime(event.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
