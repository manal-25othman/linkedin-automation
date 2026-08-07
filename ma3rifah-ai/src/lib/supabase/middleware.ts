import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

/**
 * تحديث جلسة Supabase على كل طلب وإعادة توجيه غير المصادَقين.
 * يعمل داخل middleware، لذا يقرأ متغيرات البيئة العامة مباشرة.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // مهم: getUser() يتحقق من الرمز مع خادم Supabase.
  // لا تعتمد على getSession() في التحقق من الهوية.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
