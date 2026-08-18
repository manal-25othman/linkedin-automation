"use client";

import { useActionState, type ReactNode } from "react";
import { initialFormState, type FormState } from "@/lib/form-state";
import { FormMessage, SubmitButton } from "@/components/ui/form";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * غلاف موحّد لنماذج اللوحة: يمرّر حالة الـ Server Action ويعرض رسالتها وأخطاء
 * الحقول. الحقول نفسها تُمرَّر كـ children من مكوّن الخادم، فلا تتحوّل صفحات
 * اللوحة كلها إلى مكوّنات عميل.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "حفظ",
  className,
  pendingText,
}: {
  action: Action;
  children: ReactNode;
  submitLabel?: string;
  className?: string;
  pendingText?: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const fieldErrors = Object.entries(state.errors);

  return (
    <form action={formAction} className={className ?? "space-y-4"}>
      {children}

      {fieldErrors.length > 0 ? (
        <ul className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-xs text-danger">
          {fieldErrors.map(([field, message]) => (
            <li key={field}>• {message}</li>
          ))}
        </ul>
      ) : null}

      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText={pendingText}>{submitLabel}</SubmitButton>
    </form>
  );
}
