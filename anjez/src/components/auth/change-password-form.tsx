"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions/auth";
import { initialFormState } from "@/lib/form-state";
import { Field } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePassword, initialFormState);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <p className="font-display text-lg font-bold">تغيير كلمة المرور</p>
      <p className="-mt-2 text-sm text-ink-muted">
        تغييرها ينهي جلساتك على كل الأجهزة الأخرى.
      </p>

      <Field
        label="كلمة المرور الحالية"
        htmlFor="currentPassword"
        error={state.errors.currentPassword}
        required
      >
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          className="input-field"
          autoComplete="current-password"
          required
        />
      </Field>

      <Field
        label="كلمة المرور الجديدة"
        htmlFor="newPassword"
        hint="١٠ أحرف على الأقل، فيها حرف ورقم."
        error={state.errors.newPassword}
        required
      >
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          className="input-field"
          autoComplete="new-password"
          required
        />
      </Field>

      <Field
        label="تأكيد كلمة المرور"
        htmlFor="confirmPassword"
        error={state.errors.confirmPassword}
        required
      >
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          className="input-field"
          autoComplete="new-password"
          required
        />
      </Field>

      <FormMessage status={state.status} message={state.message} />
      <SubmitButton>حفظ كلمة المرور</SubmitButton>
    </form>
  );
}
