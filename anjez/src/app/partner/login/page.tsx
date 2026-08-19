import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { loginPartner } from "@/app/actions/auth";
import { siteConfig } from "@/config/site";
import { Logo } from "@/components/layout/logo";

export const metadata: Metadata = {
  title: "دخول الشركاء",
  robots: { index: false, follow: false },
};

export default async function PartnerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-7 flex justify-center" aria-label={siteConfig.name}>
          <Logo />
        </Link>

        <div className="card p-7">
          <h1 className="font-display text-xl font-bold">دخول المسوّقين</h1>
          <p className="mb-6 mt-1 text-sm text-ink-muted">
            تابع نقراتك وطلباتك وعمولاتك من لوحتك.
          </p>

          <LoginForm action={loginPartner} next={next} />

          <p className="mt-5 text-center text-sm text-ink-muted">
            ليس لديك حساب؟{" "}
            <Link href="/partner/register" className="font-semibold text-brand hover:underline">
              سجّل مجانًا
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
