import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { serverEnv } from '@/lib/env';

/**
 * عميل بصلاحيات الخدمة — يتجاوز RLS.
 *
 * ⚠️ استخدامه محصور في عمليات لا يمكن تنفيذها بجلسة المستخدم:
 *   - إنشاء الشركة وأول مدير لها عند التسجيل
 *   - إنشاء/تعطيل المستخدمين من قبل مدير الشركة
 *   - كتابة نتائج معالجة المستندات في الخلفية
 *   - كتابة سجلات التدقيق والاستهلاك
 *
 * كل استدعاء يجب أن يسبقه تحقق صريح من الصلاحية وعزل صريح
 * بـ company_id في التطبيق، لأن قاعدة البيانات لن تحميك هنا.
 * لا يُستورد هذا الملف أبدًا في كود يعمل على المتصفح.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    serverEnv.supabaseUrl,
    serverEnv.supabaseServiceRoleKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
