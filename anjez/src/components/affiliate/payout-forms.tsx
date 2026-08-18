"use client";

import { useActionState } from "react";
import { requestPayout, savePayoutDetails } from "@/app/actions/partner";
import { initialFormState } from "@/lib/form-state";
import { Field } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { formatMoney } from "@/lib/money";

export function PayoutDetailsForm({
  defaults,
}: {
  defaults: {
    payoutMethod: string | null;
    beneficiaryName: string | null;
    iban: string | null;
    bankName: string | null;
  };
}) {
  const [state, formAction] = useActionState(savePayoutDetails, initialFormState);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <p className="font-display text-lg font-bold">بيانات التحويل</p>
      <p className="-mt-2 text-sm text-ink-muted">
        يجب أن يكون الحساب باسمك أنت؛ لا نحوّل إلى حساب طرف ثالث.
      </p>

      <Field label="وسيلة الصرف" htmlFor="payoutMethod" error={state.errors.payoutMethod} required>
        <select
          id="payoutMethod"
          name="payoutMethod"
          className="input-field"
          defaultValue={defaults.payoutMethod ?? "BANK"}
        >
          <option value="BANK">تحويل بنكي (آيبان)</option>
          <option value="STC_PAY">محفظة STC Pay</option>
        </select>
      </Field>

      <Field
        label="اسم المستفيد"
        htmlFor="beneficiaryName"
        error={state.errors.beneficiaryName}
        required
      >
        <input
          id="beneficiaryName"
          name="beneficiaryName"
          className="input-field"
          defaultValue={defaults.beneficiaryName ?? ""}
          required
        />
      </Field>

      <Field
        label="الآيبان أو رقم المحفظة"
        htmlFor="iban"
        hint="مثال: SA0000000000000000000000"
        error={state.errors.iban}
        required
      >
        <input
          id="iban"
          name="iban"
          className="input-field font-mono"
          dir="ltr"
          defaultValue={defaults.iban ?? ""}
          required
        />
      </Field>

      <Field label="اسم البنك (اختياري)" htmlFor="bankName" error={state.errors.bankName}>
        <input
          id="bankName"
          name="bankName"
          className="input-field"
          defaultValue={defaults.bankName ?? ""}
        />
      </Field>

      <FormMessage status={state.status} message={state.message} />
      <SubmitButton>حفظ البيانات</SubmitButton>
    </form>
  );
}

export function RequestPayoutForm({
  available,
  minPayout,
  canRequest,
}: {
  available: number;
  minPayout: number;
  canRequest: boolean;
}) {
  const [state, formAction] = useActionState(requestPayout, initialFormState);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <p className="font-display text-lg font-bold">طلب سحب</p>

      <div className="rounded-xl bg-surface-soft p-4">
        <p className="text-xs text-ink-muted">الرصيد المعتمد القابل للسحب</p>
        <p className="font-display text-2xl font-extrabold text-success tabular">
          {formatMoney(available)}
        </p>
        <p className="mt-1 text-xs text-ink-faint">الحدّ الأدنى للسحب {formatMoney(minPayout)}</p>
      </div>

      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="جارٍ الإرسال…" variant={canRequest ? "primary" : "secondary"}>
        اطلب سحب الرصيد
      </SubmitButton>
    </form>
  );
}
