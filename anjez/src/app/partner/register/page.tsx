import Link from "next/link";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { siteConfig } from "@/config/site";
import { Logo } from "@/components/layout/logo";
import { getSettings } from "@/lib/settings";
import { formatBps } from "@/lib/format";

export const metadata: Metadata = {
  title: "انضم كمسوّق",
  description: "سجّل مجانًا في برنامج أنجز للتسويق بالعمولة واحصل على رابطك وكودك.",
};

export default async function PartnerRegisterPage() {
  const { commission } = await getSettings();

  return (
    <div className="min-h-dvh bg-canvas px-5 py-14">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="mb-7 flex justify-center" aria-label={siteConfig.name}>
          <Logo />
        </Link>

        <div className="card p-7 md:p-9">
          <h1 className="font-display text-2xl font-extrabold">انضم كمسوّق بالعمولة</h1>
          <p className="mb-7 mt-2 text-sm leading-relaxed text-ink-muted">
            التسجيل مجاني. بعد مراجعة سريعة لحسابك يُفعَّل رابطك، وتبدأ العمولة من
            {" "}{formatBps(commission.defaultBps)} على كل طلب مدفوع عبره.
          </p>

          <RegisterForm />

          <p className="mt-5 text-center text-sm text-ink-muted">
            لديك حساب؟{" "}
            <Link href="/partner/login" className="font-semibold text-brand hover:underline">
              سجّل الدخول
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
