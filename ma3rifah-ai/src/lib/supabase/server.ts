import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { serverEnv } from '@/lib/env';

/**
 * عميل Supabase للخادم بجلسة المستخدم الحالي.
 *
 * هذا هو العميل الافتراضي لكل قراءة أو كتابة تخص المستخدم:
 * كل استعلام يمر عبر Row Level Security، فحتى لو أخطأ كود التطبيق
 * لا تتسرّب بيانات شركة إلى أخرى.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // الاستدعاء من Server Component — تحديث الجلسة يتم في middleware.
        }
      },
    },
  });
}
