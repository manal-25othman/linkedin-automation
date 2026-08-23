import 'server-only';

import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  encodeStamp,
  sessionCookieOptions,
} from '@/lib/auth/session-cookie';
import { policyFor, tierForRole } from '@/lib/auth/session-policy';
import { logger } from '@/lib/logger';

/**
 * كتابة ختم الجلسة ومحوه.
 *
 * يُستدعى في كل موضع تُنشأ فيه جلسة أو تُنهى. وأي موضع يُنسى يعني
 * مستخدمًا يدخل ثم يُطرد فورًا عند أول طلب — لأن الـmiddleware يرى جلسة
 * بلا ختم فيُنهيها. والعطل مزعج لكنه **في الاتجاه الآمن**: يمنع الدخول
 * ولا يمنحه.
 */

/** يبدأ ختمًا جديدًا — تُستأنف المهلة القصوى من الآن */
export async function stampSession(role: string | null | undefined): Promise<void> {
  const tier = tierForRole(role);
  const now = Date.now();

  const value = await encodeStamp({ tier, startedAt: now, lastSeenAt: now });

  if (!value) {
    // لا سرّ توقيع ⇒ لن يُقبل أي ختم، فكل جلسة تنتهي عند أول طلب.
    // يُسجَّل بوضوح لأن أثره يبدو للمستخدم «الدخول لا يعمل» بلا سبب ظاهر.
    logger.error(
      'تعذّر توقيع ختم الجلسة — اضبط SESSION_SECRET أو SUPABASE_SERVICE_ROLE_KEY',
    );
    return;
  }

  const store = await cookies();
  store.set(
    SESSION_COOKIE,
    value,
    sessionCookieOptions(Math.ceil(policyFor(tier).absoluteMs / 1000)),
  );
}

/** يمحو الختم — يُستدعى مع كل خروج */
export async function clearSessionStamp(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', { ...sessionCookieOptions(0), maxAge: 0 });
}
