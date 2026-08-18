"use client";

import { useState } from "react";

const ENDPOINT = process.env.NEXT_PUBLIC_NEWSLETTER_ENDPOINT ?? "";
const LIST_EMAIL = "subscribe@istidlal.ai";

/**
 * نموذج الاشتراك. عند ضبط `NEXT_PUBLIC_NEWSLETTER_ENDPOINT` يُرسل إلى مزوّد
 * النشرة؛ وقبل ذلك يفتح رسالة بريد — فلا يوجد زر يوهم المستخدم بأنه اشترك.
 */
export function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.includes("@")) return;

    if (!ENDPOINT) {
      window.location.href = `mailto:${LIST_EMAIL}?subject=${encodeURIComponent(
        "اشتراك في نشرة استدلال",
      )}&body=${encodeURIComponent(`أرجو إضافة بريدي إلى النشرة: ${email}`)}`;
      setState("done");
      return;
    }

    setState("sending");
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(response.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="rounded-xl border border-signal-line bg-signal-soft px-4 py-3 text-sm text-signal">
        تمّ. ستصلك رسالة تأكيد — لا نرسل أكثر من إصدار واحد أسبوعيًّا.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "flex flex-col gap-2 sm:flex-row" : "flex flex-col gap-3 sm:flex-row"}>
      <label className="sr-only" htmlFor="newsletter-email">
        بريدك الإلكتروني
      </label>
      <input
        id="newsletter-email"
        type="email"
        required
        dir="ltr"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
      />
      <button
        type="submit"
        disabled={state === "sending"}
        className="shrink-0 rounded-xl bg-signal px-6 py-3 text-sm font-semibold text-white transition hover:bg-signal-hover disabled:opacity-60"
      >
        {state === "sending" ? "جارٍ الإرسال…" : "اشترك"}
      </button>
      {state === "error" && (
        <p className="text-sm text-amber">تعذّر الإرسال. جرّب لاحقًا أو راسلنا مباشرة.</p>
      )}
    </form>
  );
}
