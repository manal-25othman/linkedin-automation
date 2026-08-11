import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import {
  PUBLIC_SUPABASE_ANON_KEY,
  PUBLIC_SUPABASE_URL,
  hasPublicSupabaseConfig,
} from './public-env';

/**
 * تحديث جلسة Supabase على كل طلب وإعادة توجيه غير المصادَقين.
 * يعمل داخل middleware، لذا يقرأ متغيرات البيئة العامة مباشرة.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // قبل ضبط متغيرات Supabase لا يمكن التحقق من أي جلسة. لا نرمي خطأ هنا:
  // الـmiddleware يعمل على كل طلب، ورميه يحوّل حتى صفحات التسويق العامة
  // إلى صفحة خطأ. نعيد «لا مستخدم» فتظهر الصفحات العامة كما هي، وتُحوَّل
  // الصفحات المحمية إلى /login. التشخيص متاح على /api/health.
  if (!hasPublicSupabaseConfig) {
    return { response, user: null };
  }

  const supabase = createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
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
  });

  // مهم: getUser() يتحقق من الرمز مع خادم Supabase.
  // لا تعتمد على getSession() في التحقق من الهوية.
  //
  // تعذّر الوصول إلى Supabase (انقطاع شبكة أو رابط خاطئ) يعني «لا جلسة
  // مؤكدة»، لا سقوط الموقع كله. الصفحات المحمية تُحوَّل إلى /login —
  // وهو الاتجاه الآمن: لا يمنح هذا المسار وصولًا لأحد.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { response, user };
  } catch {
    return { response, user: null };
  }
}
