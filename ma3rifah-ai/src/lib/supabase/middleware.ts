import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import {
  SESSION_COOKIE,
  decodeStamp,
  encodeStamp,
  hasSessionSecret,
  sessionCookieOptions,
} from '@/lib/auth/session-cookie';
import {
  SESSION_END_REASONS,
  evaluateSession,
  policyFor,
  shouldRefreshStamp,
  type SessionEndReason,
} from '@/lib/auth/session-policy';
import {
  PUBLIC_SUPABASE_ANON_KEY,
  PUBLIC_SUPABASE_URL,
  hasPublicSupabaseConfig,
} from './public-env';

/**
 * تحديث جلسة Supabase وفرض سياسة عمرها.
 *
 * الشقّ الثاني إضافةٌ فوق المزوّد لا استبدال له: Supabase يتحقق من صحة
 * الرمز، ولا يقول متى ينبغي أن تنتهي الجلسة — رمزُ التحديث يُجدَّد كلما
 * عاد المتصفح، فتبقى مفتوحة أسابيع. وهنا يُقرأ ختم الجلسة ويُحكَم عليه.
 */

export interface SessionCheck {
  response: NextResponse;
  user: { id: string } | null;
  /** سبب انتهاء الجلسة — يُعرض في صفحة الدخول */
  endedReason: SessionEndReason | null;
}

export async function updateSession(request: NextRequest): Promise<SessionCheck> {
  let response = NextResponse.next({ request });

  // قبل ضبط متغيرات Supabase لا يمكن التحقق من أي جلسة. لا نرمي خطأ هنا:
  // الـmiddleware يعمل على كل طلب، ورميه يحوّل حتى صفحات التسويق العامة
  // إلى صفحة خطأ. نعيد «لا مستخدم» فتظهر الصفحات العامة كما هي، وتُحوَّل
  // الصفحات المحمية إلى /login. التشخيص متاح على /api/health.
  if (!hasPublicSupabaseConfig) {
    return { response, user: null, endedReason: null };
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
  let user: { id: string } | null = null;
  try {
    const {
      data: { user: found },
    } = await supabase.auth.getUser();
    user = found;
  } catch {
    return { response, user: null, endedReason: null };
  }

  if (!user) return { response, user: null, endedReason: null };

  // ---------------------------------------------------- فرض عمر الجلسة

  const stamp = await decodeStamp(request.cookies.get(SESSION_COOKIE)?.value);

  if (!stamp) {
    // جلسة Supabase قائمة بلا ختم صالح. ثلاث حالات تؤدي إليها: ختم
    // مزوَّر، أو ختم حُذف، أو جلسة أُنشئت قبل تفعيل هذه السياسة. وكلها
    // تُعامَل معاملةً واحدة — إنهاء — لأن التمييز بينها متعذّر، ولأن
    // الاحتمال الوحيد الذي يستحق التساهل (الجلسة القديمة) هو نفسه
    // الذي أرادت هذه السياسة إنهاءه.
    //
    // وأثره عند النشر: كل من كان داخلًا يُطالَب بالدخول مرة واحدة.
    return {
      response,
      user: null,
      endedReason: hasSessionSecret() ? SESSION_END_REASONS.MALFORMED : null,
    };
  }

  const now = Date.now();
  const verdict = evaluateSession(stamp, now);

  if (verdict !== 'OK') {
    return { response, user: null, endedReason: SESSION_END_REASONS[verdict] };
  }

  // تحديث ختم آخر نشاط — لا على كل طلب بل كل دقيقة
  if (shouldRefreshStamp(stamp, now)) {
    const refreshed = await encodeStamp({ ...stamp, lastSeenAt: now });
    if (refreshed) {
      // عمر الكوكي = ما بقي من المهلة القصوى، فينتهي بنفسه في المتصفح
      // ولا يبقى معلّقًا بعد أن صار بلا معنى
      const policy = policyFor(stamp.tier);
      const remainingMs = Math.max(0, stamp.startedAt + policy.absoluteMs - now);
      response.cookies.set(
        SESSION_COOKIE,
        refreshed,
        sessionCookieOptions(Math.ceil(remainingMs / 1000)),
      );
    }
  }

  return { response, user, endedReason: null };
}
