"use client";

import { useActionState } from "react";
import { initialFormState, type FormState } from "@/lib/form-state";
import { Field } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function LoginForm({ action, next }: { action: Action; next?: string }) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field label="البريد الإلكتروني" htmlFor="email" error={state.errors.email} required>
        <input
          id="email"
          name="email"
          type="email"
          className="input-field"
          autoComplete="email"
          required
        />
      </Field>

      <Field label="كلمة المرور" htmlFor="password" error={state.errors.password} required>
        <input
          id="password"
          name="password"
          type="password"
          className="input-field"
          autoComplete="current-password"
          required
        />
      </Field>

      <FormMessage status={state.status} message={state.message} />
      <SubmitButton className="w-full" pendingText="جارٍ الدخول…">
        تسجيل الدخول
      </SubmitButton>
    </form>
  );
}
