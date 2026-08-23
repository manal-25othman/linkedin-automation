/**
 * سياسة عمر الجلسة.
 *
 * جلسة Supabase لا تنتهي من نفسها: رمز التحديث يُجدَّد تلقائيًا كلما عاد
 * المتصفح، فتبقى الجلسة مفتوحة أسابيع. وهذا مقبول لمنتج استهلاكي،
 * وغيرُ مقبول لمنصّة تحمل لوائح شركات وبيانات موظفين — ومرفوض تمامًا
 * لحساب يرى كل الشركات.
 *
 * فهذه الطبقة تفرض ما لا يفرضه المزوّد: مهلتان معًا.
 *
 *   • **مهلة الخمول** — تُقاس من آخر نشاط. تحمي الجهاز المتروك مفتوحًا.
 *   • **المهلة القصوى** — تُقاس من لحظة الدخول ولا يمدّدها نشاط. تحمي
 *     من جلسة مسروقة تُبقيها حركةٌ آلية حيّةً إلى الأبد.
 *
 * والثانية هي التي تُنسى عادةً، وهي التي تجعل تسريب كوكي مشكلةً لأسبوع
 * لا لساعات.
 *
 * وهذا الملف **حساب خالص بلا إدخال ولا إخراج** كي يُختبر: قرار إنهاء
 * جلسة مدير المنصة أخطر من أن يُترك بلا اختبار يثبته.
 */

/** رتبة السياسة — تُشتق من الدور وتُحفظ في الكوكي */
export type SessionTier = 'ADMIN' | 'STANDARD';

export interface SessionPolicy {
  /** أقصى سكون قبل الإنهاء */
  idleMs: number;
  /** أقصى عمر للجلسة مهما كان النشاط */
  absoluteMs: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * السياسات.
 *
 * الأرقام اجتهاد موازنة بين الأمان والاحتمال: مهلة خمول ربع ساعة لمدير
 * المنصة تُغضبه وتدفعه إلى حيلة تُبقي الجلسة حيّة، فتُنتج أمانًا أسوأ من
 * الذي أرادته. وثماني ساعات لموظف تغطّي يوم عمل كاملًا بلا إعادة دخول.
 */
const POLICIES: Record<SessionTier, SessionPolicy> = {
  // مدير المنصة ومدير الشركة: يرى بيانات غيره، فجلسته أقصر
  ADMIN: { idleMs: 60 * MINUTE, absoluteMs: 12 * HOUR },
  // مدير قسم وموظف: يرى ما يخصّه، ويوم العمل لا يُقطع بلا سبب
  STANDARD: { idleMs: 8 * HOUR, absoluteMs: 30 * DAY },
};

/** الأدوار التي تخضع للسياسة المشدَّدة */
const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'COMPANY_ADMIN']);

export function tierForRole(role: string | null | undefined): SessionTier {
  // المجهول يُعامَل معاملة المدير: الخطأ في اتجاه التشديد لا التخفيف.
  // ودورٌ لم نعرفه قد يكون دورًا جديدًا لم تُحدَّث هذه القائمة له بعد.
  if (!role) return 'ADMIN';
  return ADMIN_ROLES.has(role) ? 'ADMIN' : 'STANDARD';
}

export function policyFor(tier: SessionTier): SessionPolicy {
  return POLICIES[tier];
}

export type SessionVerdict = 'OK' | 'IDLE_EXPIRED' | 'ABSOLUTE_EXPIRED' | 'MALFORMED';

export interface SessionStamp {
  tier: SessionTier;
  /** لحظة تسجيل الدخول (مللي ثانية) */
  startedAt: number;
  /** لحظة آخر طلب (مللي ثانية) */
  lastSeenAt: number;
}

/**
 * الحكم على جلسة.
 *
 * تُفحص المهلة القصوى قبل الخمول لأنها الأقوى: جلسة تجاوزت عمرها
 * الأقصى تنتهي ولو كان صاحبها نشطًا هذه اللحظة.
 */
export function evaluateSession(stamp: SessionStamp, now: number): SessionVerdict {
  const policy = policyFor(stamp.tier);

  if (
    !Number.isFinite(stamp.startedAt) ||
    !Number.isFinite(stamp.lastSeenAt) ||
    stamp.startedAt <= 0 ||
    stamp.lastSeenAt <= 0
  ) {
    return 'MALFORMED';
  }

  // ختمٌ من المستقبل يعني ساعةً معدَّلة أو كوكي مُلاعَبًا به. ولا يُقبل:
  // قبولُه يجعل تقديم الساعة وسيلةً لتمديد الجلسة بلا حدّ.
  const SKEW_MS = 5 * MINUTE;
  if (stamp.startedAt > now + SKEW_MS || stamp.lastSeenAt > now + SKEW_MS) {
    return 'MALFORMED';
  }

  if (now - stamp.startedAt >= policy.absoluteMs) return 'ABSOLUTE_EXPIRED';
  if (now - stamp.lastSeenAt >= policy.idleMs) return 'IDLE_EXPIRED';

  return 'OK';
}

/**
 * هل يستحق تحديث ختم آخر نشاط؟
 *
 * الكتابة على كل طلب تعني ترويسة `Set-Cookie` مع كل صورة وكل استدعاء —
 * حملٌ بلا فائدة، ويُبطل التخزين المؤقت للاستجابات. والتحديث كل دقيقة
 * يكفي لمهلة خمول أقلّها ساعة.
 */
export function shouldRefreshStamp(stamp: SessionStamp, now: number): boolean {
  return now - stamp.lastSeenAt >= MINUTE;
}

/** رسالة تُعرض للمستخدم بحسب سبب الإنهاء */
export const SESSION_END_REASONS = {
  IDLE_EXPIRED: 'session_idle',
  ABSOLUTE_EXPIRED: 'session_expired',
  MALFORMED: 'session_invalid',
} as const;

export type SessionEndReason =
  (typeof SESSION_END_REASONS)[keyof typeof SESSION_END_REASONS];

/**
 * مدة بالعربية لعرضها على المستخدم.
 *
 * العربية تُعرب العدد مع المعدود، و«1 ساعات» خطأ يُقرأ إهمالًا. فتُكتب
 * الصيغ صراحةً: المفرد والمثنى والجمع.
 */
export function formatDurationAr(ms: number): string {
  const minutes = Math.round(ms / 60_000);

  if (minutes < 60) {
    if (minutes === 1) return 'دقيقة';
    if (minutes === 2) return 'دقيقتين';
    return `${minutes} دقيقة`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    if (hours === 1) return 'ساعة';
    if (hours === 2) return 'ساعتين';
    return hours <= 10 ? `${hours} ساعات` : `${hours} ساعة`;
  }

  const days = Math.round(hours / 24);
  if (days === 1) return 'يوم';
  if (days === 2) return 'يومين';
  return days <= 10 ? `${days} أيام` : `${days} يومًا`;
}
