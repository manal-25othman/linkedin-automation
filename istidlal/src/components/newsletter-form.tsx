"use client";

import { useState } from "react";

type FormState = "idle" | "sending" | "done" | "invalid" | "rate_limited" | "error";

const MESSAGES: Record<Exclude<FormState, "idle" | "sending" | "done">, string> = {
  invalid: "تحقّق من صيغة البريد.",
  rate_limited: "محاولات كثيرة من هذا الجهاز. جرّب بعد ساعة.",
  error: "تعذّر تسجيل الاشتراك الآن. جرّب لاحقًا.",
};

/**
 * نموذج الاشتراك.
 *
 * لا يظهر إلا إذا كان المزوّد مضبوطًا على الخادم (`enabled`)، فلا يوجد زرّ
 * يوهم القارئ بأنه اشترك. والرسالة الخضراء لا تظهر إلا بعد ردّ ناجح فعلي.
 */
export function NewsletterForm({
  compact = false,
  enabled,
}: {
  compact?: boolean;
  enabled: boolean;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");

  if (!enabled) {
    return (
      <div className="rounded-xl border border-line bg-surface-soft px-4 py-3 text-sm leading-7 text-ink-muted">
        النشرة البريدية لم تُفتَح بعد. حتى ذلك الحين، تصلك المقالات كاملةً عبر{" "}
        <a href="/rss.xml" className="text-signal underline">
          تغذية RSS
        </a>
        .
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          company: form.get("company"),
        }),
      });

      if (response.ok) {
        setState("done");
        return;
      }
      if (response.status === 400) setState("invalid");
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
        className="rounded-xl border border-signal-line bg-signal-soft px-4 py-3 text-sm leading-7 text-signal"
      >
        سُجّل بريدك. ستصلك رسالة تأكيد — ولا نرسل أكثر من إصدار واحد أسبوعيًّا.
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={compact ? "flex flex-col gap-2 sm:flex-row" : "flex flex-col gap-3 sm:flex-row"}
    >
      <label className="sr-only" htmlFor="newsletter-email">
        بريدك الإلكتروني
      </label>
      <input
        id="newsletter-email"
        name="email"
        type="email"
        required
        dir="ltr"
        autoComplete="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (state !== "idle" && state !== "sending") setState("idle");
        }}
        aria-invalid={state === "invalid"}
        aria-describedby={state === "idle" || state === "sending" ? undefined : "newsletter-error"}
        placeholder="you@example.com"
        className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
      />

      {/* حقل فخّ مخفي عن البشر ومقروء للروبوتات. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden opacity-0"
      />

      <button
        type="submit"
        disabled={state === "sending"}
        className="shrink-0 rounded-xl bg-signal px-6 py-3 text-sm font-semibold text-white transition hover:bg-signal-hover disabled:opacity-60"
      >
        {state === "sending" ? "جارٍ الإرسال…" : "اشترك"}
      </button>

      {state !== "idle" && state !== "sending" && (
        <p id="newsletter-error" role="alert" className="text-sm text-amber sm:basis-full">
          {MESSAGES[state]}
        </p>
      )}
    </form>
  );
}
