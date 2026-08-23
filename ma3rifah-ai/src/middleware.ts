import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { SESSION_COOKIE } from '@/lib/auth/session-cookie';

/** مسارات تتطلب تسجيل دخول */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/assistant',
  '/knowledge-base',
  '/documents',
  '/conversations',
  '/help',

  '/knowledge-gaps',
  '/analytics',
  '/users',
  '/departments',
  '/settings',
  '/support',
  '/admin',
];

/** مسارات لا يدخلها من سجّل دخوله بالفعل */
const AUTH_ROUTES = ['/login', '/register'];

/**
 * أسماء كوكيات Supabase — تُمسح عند إنهاء الجلسة.
 *
 * الاسم يحمل معرّف المشروع فلا يمكن سرده مسبقًا، فيُمسح كل ما يبدأ
 * بالبادئة. وترك الكوكي بعد إنهاء الجلسة يجعل المتصفح يعيد إرساله في
 * كل طلب، فيتكرر الفحص والإنهاء بلا نهاية.
 */
function clearAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-') || cookie.name === SESSION_COOKIE) {
      response.cookies.set(cookie.name, '', { path: '/', maxAge: 0 });
    }
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user, endedReason } = await updateSession(request);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  // انتهت الجلسة بحكم السياسة: تُمسح الكوكيات أينما كان المستخدم، كي لا
  // تبقى جلسة ميّتة تُفحص في كل طلب. والتحويل إلى الدخول للمسارات
  // المحمية وحدها — من كان يقرأ صفحة تعريفية لا يُقطع عليه ما يقرؤه.
  if (endedReason) {
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set('error', endedReason);
      // لا يُعاد إلى صفحة قد تحمل بيانات غير محفوظة بلا علمه، لكن
      // معرفة أين كان تُريحه من البحث عن مكانه بعد الدخول
      url.searchParams.set('redirectTo', pathname);
      const redirect = NextResponse.redirect(url);
      clearAuthCookies(request, redirect);
      return redirect;
    }

    clearAuthCookies(request, response);
    return response;
  }

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * كل المسارات عدا الملفات الثابتة والصور.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
