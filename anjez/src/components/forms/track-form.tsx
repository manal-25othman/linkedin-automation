"use client";

import { useActionState } from "react";
import { trackOrder } from "@/app/actions/orders";
import { initialFormState } from "@/lib/form-state";
import { Field } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";

export function TrackForm() {
  const [state, formAction] = useActionState(trackOrder, initialFormState);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <Field label="رقم الطلب" htmlFor="orderNumber" error={state.errors.orderNumber} required>
        <input
          id="orderNumber"
          name="orderNumber"
          className="input-field uppercase"
          placeholder="ANJ-2608-XXXXXX"
          required
        />
      </Field>

      <Field label="رقم الجوال" htmlFor="phone" error={state.errors.phone} required>
        <input
          id="phone"
          name="phone"
          className="input-field"
          inputMode="tel"
          placeholder="05xxxxxxxx"
          required
        />
      </Field>

      <FormMessage status={state.status} message={state.message} />
      <SubmitButton className="w-full" pendingText="جارٍ البحث…">
        عرض حالة الطلب
      </SubmitButton>
    </form>
  );
}
