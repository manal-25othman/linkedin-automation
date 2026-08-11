import 'server-only';
import {
  PUBLIC_SUPABASE_ANON_KEY,
  PUBLIC_SUPABASE_URL,
  hasPublicSupabaseConfig,
} from '@/lib/supabase/public-env';

/**
 * فحص حيّ لاتصال Supabase.
 *
 * وجود متغيّر بيئة لا يعني أن قيمته صحيحة: مفتاح خاطئ أو رابط مشروع
 * آخر أو هجرات غير مطبَّقة كلها تُنتج للمستخدم رسالة عامة واحدة، فيصير
 * التشخيص تخمينًا. هنا نصنّف الفشل إلى حالات محددة.
 *
 * ما يُعاد تصنيفات ثابتة لا نصوص أخطاء: هذا المسار عام، ونصوص الأخطاء
 * الداخلية لا تُعرض للعامة.
 */

const TIMEOUT_MS = 5000;

type RestStatus =
  | 'ok'
  | 'unconfigured'
  | 'invalid_key'
  | 'schema_missing'
  | 'not_found'
  | 'unreachable'
  | 'unexpected_status';

type AuthStatus =
  | 'ok'
  | 'unconfigured'
  | 'invalid_key'
  | 'not_found'
  | 'unreachable'
  | 'unexpected_status';

export type SupabaseProbe = {
  rest: RestStatus;
  auth: AuthStatus;
  /**
   * الرابط المستعمل فعلًا بعد التنظيف. عرضه هنا ليس تسريبًا: قيمة
   * NEXT_PUBLIC_SUPABASE_URL تُشحن أصلًا إلى كل متصفح ضمن حزمة الواجهة.
   * إظهارها ينهي التخمين حين يكون الخطأ في الرابط نفسه.
   */
  url: string;
  /** من إعدادات Supabase العامة — تُقرأ أصلًا من أي متصفح */
  signupEnabled: boolean | null;
  emailAutoconfirm: boolean | null;
};

async function request(path: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${PUBLIC_SUPABASE_URL}${path}`, {
      headers: {
        apikey: PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${PUBLIC_SUPABASE_ANON_KEY}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function probeSupabase(): Promise<SupabaseProbe> {
  if (!hasPublicSupabaseConfig) {
    return {
      rest: 'unconfigured',
      auth: 'unconfigured',
      url: PUBLIC_SUPABASE_URL,
      signupEnabled: null,
      emailAutoconfirm: null,
    };
  }

  // جدول plans عام بطبيعته (سياسة قراءة للزوار)، فهو مسبار مناسب:
  // 200 يعني المفتاح صالح والهجرات مطبَّقة.
  let rest: RestStatus;
  try {
    const response = await request('/rest/v1/plans?select=id&limit=1');
    if (response.ok) rest = 'ok';
    else if (response.status === 401 || response.status === 403) rest = 'invalid_key';
    else if (response.status === 404) rest = 'schema_missing';
    else rest = 'unexpected_status';
  } catch {
    rest = 'unreachable';
  }

  let auth: AuthStatus;
  let signupEnabled: boolean | null = null;
  let emailAutoconfirm: boolean | null = null;
  try {
    const response = await request('/auth/v1/settings');
    if (response.ok) {
      auth = 'ok';
      const settings = (await response.json()) as {
        disable_signup?: boolean;
        mailer_autoconfirm?: boolean;
      };
      signupEnabled = settings.disable_signup === undefined ? null : !settings.disable_signup;
      emailAutoconfirm = settings.mailer_autoconfirm ?? null;
    } else if (response.status === 401 || response.status === 403) {
      auth = 'invalid_key';
    } else if (response.status === 404) {
      // خدمة المصادقة موجودة في كل مشروع Supabase، فـ404 هنا يعني أن
      // الرابط لا يشير إلى جذر واجهة المشروع أصلًا.
      auth = 'not_found';
    } else {
      auth = 'unexpected_status';
    }
  } catch {
    auth = 'unreachable';
  }

  return { rest, auth, url: PUBLIC_SUPABASE_URL, signupEnabled, emailAutoconfirm };
}
