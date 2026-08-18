"use client";

import { useActionState, useState } from "react";
import { submitOrder } from "@/app/actions/orders";
import { initialFormState } from "@/lib/form-state";
import { Field } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { formatMoney } from "@/lib/money";

export type TierOption = {
  id: string;
  name: string;
  price: number;
  deliveryDays: number;
  features: string;
};

export function OrderForm({
  tiers,
  defaultTierId,
}: {
  tiers: TierOption[];
  defaultTierId: string;
}) {
  const [state, formAction] = useActionState(submitOrder, initialFormState);
  const [selectedId, setSelectedId] = useState(defaultTierId);

  const selected = tiers.find((tier) => tier.id === selectedId) ?? tiers[0];

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <fieldset>
          <legend className="mb-3 font-display text-lg font-bold">الباقة</legend>
          <div className="space-y-3">
            {tiers.map((tier) => (
              <label
                key={tier.id}
                className={`card flex cursor-pointer items-start gap-3 p-4 transition-colors ${
                  selectedId === tier.id ? "border-brand ring-1 ring-brand-soft" : ""
                }`}
              >
                <input
                  type="radio"
                  name="tierId"
                  value={tier.id}
                  checked={selectedId === tier.id}
                  onChange={() => setSelectedId(tier.id)}
                  className="mt-1.5 accent-brand"
                />
                <span className="flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{tier.name}</span>
                    <span className="font-display font-extrabold text-brand tabular">
                      {formatMoney(tier.price)}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-ink-muted">
                    التسليم خلال {tier.deliveryDays} أيام عمل
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الاسم" htmlFor="customerName" error={state.errors.customerName} required>
            <input
              id="customerName"
              name="customerName"
              className="input-field"
              autoComplete="name"
              required
            />
          </Field>

          <Field
            label="رقم الجوال"
            htmlFor="customerPhone"
            hint="لمتابعة الطلب والتواصل معك"
            error={state.errors.customerPhone}
            required
          >
            <input
              id="customerPhone"
              name="customerPhone"
              className="input-field"
              inputMode="tel"
              placeholder="05xxxxxxxx"
              autoComplete="tel"
              required
            />
          </Field>
        </div>

        <Field
          label="البريد الإلكتروني (اختياري)"
          htmlFor="customerEmail"
          error={state.errors.customerEmail}
        >
          <input
            id="customerEmail"
            name="customerEmail"
            type="email"
            className="input-field"
            autoComplete="email"
          />
        </Field>

        <Field
          label="تفاصيل طلبك"
          htmlFor="notes"
          hint="كلما وضّحت أكثر، سلّمنا أسرع وبلا مراجعات."
          error={state.errors.notes}
        >
          <textarea id="notes" name="notes" rows={5} className="input-field" />
        </Field>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="card p-5">
          <p className="font-display text-lg font-bold">ملخّص الطلب</p>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">الباقة</dt>
              <dd className="font-medium">{selected?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">المدّة</dt>
              <dd className="font-medium">{selected?.deliveryDays} أيام عمل</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3">
              <dt className="font-semibold">الإجمالي قبل الخصم</dt>
              <dd className="font-display text-lg font-extrabold text-brand tabular">
                {selected ? formatMoney(selected.price) : "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-line pt-4">
            <Field
              label="كود خصم (اختياري)"
              htmlFor="couponCode"
              hint="يُطبَّق الخصم على صفحة الدفع."
              error={state.errors.couponCode}
            >
              <input
                id="couponCode"
                name="couponCode"
                className="input-field uppercase"
                autoCapitalize="characters"
              />
            </Field>
          </div>

          <div className="mt-5 space-y-3">
            <FormMessage status={state.status} message={state.message} />
            <SubmitButton className="w-full" size="lg" pendingText="جارٍ التحويل للدفع…">
              متابعة الدفع
            </SubmitButton>
            <p className="text-center text-xs text-ink-faint">
              بالمتابعة أنت توافق على شروط الخدمة وسياسة الاسترجاع.
            </p>
          </div>
        </div>
      </aside>
    </form>
  );
}
