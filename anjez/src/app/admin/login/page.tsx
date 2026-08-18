import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { loginAdmin } from "@/app/actions/auth";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "دخول الإدارة",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center font-display text-2xl font-extrabold">
          {siteConfig.name}
        </Link>

        <div className="card p-7">
          <h1 className="mb-6 font-display text-xl font-bold">دخول الإدارة</h1>
          <LoginForm action={loginAdmin} next={next} />
        </div>
      </div>
    </div>
  );
}
