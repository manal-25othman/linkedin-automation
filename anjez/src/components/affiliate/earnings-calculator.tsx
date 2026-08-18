"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { formatBps, formatNumber } from "@/lib/format";

/**
 * حاسبة تقديرية على أرقام حقيقية من الإعدادات، لا وعود ثابتة في النص:
 * تعديل الأدمن للنسبة ينعكس هنا فورًا بلا تحديث محتوى تسويقي منفصل.
 */
export function EarningsCalculator({
  averageOrder,
  rateBps,
  goldRateBps,
}: {
  averageOrder: number;
  rateBps: number;
  goldRateBps: number;
}) {
  const [ordersPerMonth, setOrdersPerMonth] = useState(10);

  const monthly = Math.floor((averageOrder * rateBps) / 10_000) * ordersPerMonth;
  const monthlyGold = Math.floor((averageOrder * goldRateBps) / 10_000) * ordersPerMonth;

  return (
    <div className="card p-6">
      <p className="font-display text-lg font-bold">كم يمكن أن تكسب؟</p>
      <p className="mt-1 text-sm text-ink-muted">
        على متوسّط طلب {formatMoney(averageOrder)} ونسبة {formatBps(rateBps)}.
      </p>

      <label className="mt-6 block text-sm font-semibold" htmlFor="ordersPerMonth">
        عدد الطلبات شهريًا عبر رابطك:{" "}
        <span className="text-brand tabular">{formatNumber(ordersPerMonth)}</span>
      </label>
      <input
        id="ordersPerMonth"
        type="range"
        min={1}
        max={100}
        value={ordersPerMonth}
        onChange={(event) => setOrdersPerMonth(Number(event.target.value))}
        className="mt-3 w-full accent-brand"
      />

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-surface-soft p-4">
          <dt className="text-xs text-ink-muted">دخلك الشهري التقديري</dt>
          <dd className="font-display text-2xl font-extrabold text-brand tabular">
            {formatMoney(monthly)}
          </dd>
        </div>
        <div className="rounded-xl bg-gold-soft p-4">
          <dt className="text-xs text-ink-muted">وبالمستوى الذهبي</dt>
          <dd className="font-display text-2xl font-extrabold text-gold tabular">
            {formatMoney(monthlyGold)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-ink-faint">
        تقدير للتوضيح فقط، والعمولة الفعلية تُحسب على الطلبات المدفوعة والمكتملة.
      </p>
    </div>
  );
}
