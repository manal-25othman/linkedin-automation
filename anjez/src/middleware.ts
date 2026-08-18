import { NextResponse, type NextRequest } from "next/server";
import { REF_COOKIE, REF_QUERY_PARAM } from "@/lib/affiliate/attribution";

/** نافذة افتراضية للكوكي حين تُلتقط من ?ref= — الإعدادات لا تُقرأ في الـ middleware. */
const DEFAULT_WINDOW_DAYS = 30;

/**
 * وظيفتان فقط:
 *  1) التقاط ?ref=CODE من أي صفحة وتحويلها إلى كوكي، ثم تنظيف الرابط
 *     حتى لا يُشارك الزائر رابطًا يحمل كود غيره.
 *  2) صدّ الوصول لللوحات بلا كوكي جلسة — والتحقّق الحقيقي من الصلاحية يبقى
 *     في الصفحات نفسها (lib/auth/guard).
 *
 * لا استعلام قاعدة بيانات هنا: الـ middleware يعمل على حافة الشبكة، وصحّة الكود
 * تُفحص لاحقًا عند إنشاء الطلب.
 */
export function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const ref = nextUrl.searchParams.get(REF_QUERY_PARAM);

  if (ref) {
    const cleanUrl = new URL(nextUrl);
    cleanUrl.searchParams.delete(REF_QUERY_PARAM);

    const response = NextResponse.redirect(cleanUrl);
    const code = ref.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);

    if (code) {
      response.cookies.set(REF_COOKIE, `${code}:${Date.now()}`, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: DEFAULT_WINDOW_DAYS * 24 * 60 * 60,
      });
    }

    return response;
  }

  const path = nextUrl.pathname;
  const isGuardedArea =
    (path.startsWith("/admin") && !path.startsWith("/admin/login")) ||
    (path.startsWith("/partner") &&
      !path.startsWith("/partner/login") &&
      !path.startsWith("/partner/register"));

  if (isGuardedArea && !request.cookies.get("anjez_session")) {
    const loginUrl = new URL(path.startsWith("/admin") ? "/admin/login" : "/partner/login", nextUrl);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/).*)"],
};
