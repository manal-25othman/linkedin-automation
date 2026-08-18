"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAffiliate } from "@/app/actions/partner";
import { initialFormState } from "@/lib/form-state";
import { Field } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAffiliate, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم الكامل" htmlFor="name" error={state.errors.name} required>
          <input id="name" name="name" className="input-field" autoComplete="name" required />
        </Field>

        <Field label="رقم الجوال" htmlFor="phone" error={state.errors.phone} required>
          <input
            id="phone"
            name="phone"
            className="input-field"
            inputMode="tel"
            placeholder="05xxxxxxxx"
            autoComplete="tel"
            required
          />
        </Field>
      </div>

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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="كلمة المرور"
          htmlFor="password"
          hint="١٠ أحرف على الأقل، فيها حرف ورقم."
          error={state.errors.password}
          required
        >
          <input
            id="password"
            name="password"
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
      </div>

      <Field
        label="كيف ستسوّق لخدماتنا؟"
        htmlFor="promotionPlan"
        hint="اذكر قنواتك: حساب تواصل، مجموعة، مدوّنة، قائمة بريدية… وحجم متابعيك."
        error={state.errors.promotionPlan}
        required
      >
        <textarea id="promotionPlan" name="promotionPlan" rows={4} className="input-field" required />
      </Field>

      <label className="flex items-start gap-2 text-sm text-ink-soft">
        <input type="checkbox" name="acceptTerms" className="mt-1 accent-brand" required />
        <span>
          أوافق على{" "}
          <Link href="/terms" className="text-brand hover:underline" target="_blank">
            شروط برنامج العمولة
          </Link>
          ، وألتزم بعدم الرسائل المزعجة أو الإعلانات باسم المنصّة.
        </span>
      </label>
      {state.errors.acceptTerms ? (
        <p className="text-xs font-medium text-danger">{state.errors.acceptTerms}</p>
      ) : null}

      <FormMessage status={state.status} message={state.message} />
      <SubmitButton className="w-full" size="lg" pendingText="جارٍ إنشاء الحساب…">
        إنشاء حساب مسوّق
      </SubmitButton>
    </form>
  );
}
