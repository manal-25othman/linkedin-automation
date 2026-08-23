"use client";

import { useState } from "react";

type FormState = "idle" | "sending" | "done" | "invalid" | "rate_limited" | "error";

const MESSAGES: Record<Exclude<FormState, "idle" | "sending" | "done">, string> = {
  invalid: "راجع الحقول: كلّها مطلوبة، والرسالة عشرون حرفًا فأكثر.",
  rate_limited: "أُرسلت رسائل كثيرة من هذا الجهاز. جرّب بعد ساعة.",
  error: "تعذّر الإرسال الآن. جرّب لاحقًا أو راسلنا مباشرةً على البريد أعلاه.",
};

export function ContactForm({ enabled }: { enabled: boolean }) {
  const [state, setState] = useState<FormState>("idle");

  if (!enabled) return null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });

      if (response.ok) setState("done");
      else if (response.status === 400) setState("invalid");
      else if (response.status === 429) setState("rate_limited");
      else setState("error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p
        role="status"
        className="not-prose rounded-xl border border-signal-line bg-signal-soft px-4 py-3 text-sm leading-7 text-signal"
      >
        وصلت رسالتك. نردّ عادةً خلال ثلاثة أيام عمل.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="not-prose flex flex-col gap-4">
      <Field id="contact-name" name="name" label="الاسم" autoComplete="name" />
      <Field id="contact-email" name="email" label="بريدك" type="email" dir="ltr" autoComplete="email" />
      <Field id="contact-subject" name="subject" label="الموضوع" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-message" className="text-sm font-medium text-ink">
          الرسالة
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={6}
          required
          minLength={20}
          className="rounded-xl border border-line bg-surface px-4 py-3 text-sm leading-7 text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
          placeholder="اذكر السياق والرابط إن كان تصحيحًا لخطأ في مقال."
        />
      </div>

      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden opacity-0"
      />

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={state === "sending"}
          className="rounded-xl bg-signal px-6 py-3 text-sm font-semibold text-white transition hover:bg-signal-hover disabled:opacity-60"
        >
          {state === "sending" ? "جارٍ الإرسال…" : "أرسل"}
        </button>

        {state !== "idle" && state !== "sending" && (
          <p role="alert" className="text-sm text-amber">
            {MESSAGES[state]}
          </p>
        )}
      </div>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  type = "text",
  dir,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  dir?: "ltr" | "rtl";
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        dir={dir}
        required
        autoComplete={autoComplete}
        className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
      />
    </div>
  );
}
