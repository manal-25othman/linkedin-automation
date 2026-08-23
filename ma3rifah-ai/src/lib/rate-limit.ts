import 'server-only';

import { AppError } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * تحديد معدّل الطلبات — عدّاد مشترك في القاعدة، وذاكرةٌ عند تعذّره.
 *
 * كان العدّاد في `Map` داخل ذاكرة عملية Node. وهذا يعمل على خادم واحد،
 * والنشر على Vercel يشغّل نسخًا كثيرة متوازية لكلٍّ منها ذاكرتها: فمن
 * وُضع له حدّ ثماني محاولات دخول يملك فعليًا ثمانيًا **لكل نسخة**،
 * والنسخ تزداد كلّما زاد الضغط — أي أن الحماية تضعف بالضبط حين تُحتاج.
 * والعطل صامت: لا خطأ ولا سجلّ، والحدّ يبدو مطبَّقًا تمامًا في الشيفرة.
 *
 * والمخزن هو Postgres نفسه لا خدمة جديدة: لا مفتاح إضافي ولا فاتورة.
 *
 * ---------------------------------------------------------------------
 * حين تتعذّر القاعدة: يُسمح بالطلب بعد عدّه في الذاكرة
 *
 * قرارٌ مقصود لا إغفال. الإغلاق عند تعذّر القاعدة يعني أن عطلًا في
 * القاعدة يمنع **كل** تسجيل دخول وكل رفع مستند — أي أن أداة الحماية
 * تصير هي العطل، وتحوّل خللًا جزئيًا إلى انقطاع تامّ.
 *
 * والبديل ليس السماح المطلق: يُرجَع إلى عدّاد الذاكرة، وهو ما كان
 * قائمًا وحده قبل هذه الترحيلة. فالتدهور إلى الحماية السابقة لا إلى
 * لا حماية.
 * ---------------------------------------------------------------------
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (
      bucket.timestamps.length === 0 ||
      now - bucket.timestamps[bucket.timestamps.length - 1] > SWEEP_INTERVAL_MS
    ) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitRule {
  /** عدد الطلبات المسموح بها */
  limit: number;
  /** طول النافذة بالميلي ثانية */
  windowMs: number;
}

export const RATE_LIMITS = {
  /** أسئلة المساعد الذكي — الأغلى تكلفة */
  chat: { limit: 20, windowMs: 60_000 },
  /**
   * محادثة زوّار الموقع — أضيق من حد الموظفين.
   * الزائر مجهول ولا يستهلك حصة شركة بل رصيد المنصة مباشرة.
   */
  siteChat: { limit: 6, windowMs: 60_000 },
  /** رفع المستندات */
  upload: { limit: 15, windowMs: 60_000 },
  /** عمليات الكتابة العامة */
  mutation: { limit: 60, windowMs: 60_000 },
  /**
   * محاولات المصادقة — الأضيق على الإطلاق.
   *
   * الدخول والتسجيل واستعادة كلمة المرور مسارات مفتوحة بلا جلسة، فهي
   * السطح الوحيد الذي يُهاجَم بلا حساب. والحدّ هنا يقطع رشّ كلمات المرور
   * (password spraying) وحشو بيانات الاعتماد قبل أن يبلغا حجمًا مؤثرًا.
   *
   * والحدّ على البريد لا على العنوان وحده: مهاجم من عناوين كثيرة على
   * حساب واحد يمرّ من حدّ العنوان، وهو النمط الشائع.
   */
  auth: { limit: 8, windowMs: 300_000 },
} satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  /** true حين تعذّرت القاعدة فحُسب الحدّ في ذاكرة هذه النسخة وحدها */
  degraded: boolean;
}

/** العدّاد الاحتياطي — نافذة منزلقة دقيقة داخل نسخة واحدة */
function checkInMemory(identifier: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(identifier) ?? { timestamps: [] };
  const windowStart = now - rule.windowMs;
  bucket.timestamps = bucket.timestamps.filter((time) => time > windowStart);

  if (bucket.timestamps.length >= rule.limit) {
    buckets.set(identifier, bucket);
    const oldest = bucket.timestamps[0];
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000)),
      degraded: true,
    };
  }

  bucket.timestamps.push(now);
  buckets.set(identifier, bucket);

  return { allowed: true, retryAfterSeconds: 0, degraded: true };
}

export async function checkRateLimit(
  identifier: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_key: identifier,
      p_limit: rule.limit,
      p_window_ms: rule.windowMs,
    });

    if (error) throw error;

    // الدالة تعيد صفًّا واحدًا؛ وغيابه يعني عقدًا مكسورًا لا سماحًا
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.allowed !== 'boolean') {
      throw new Error('استجابة غير متوقعة من check_rate_limit');
    }

    return {
      allowed: row.allowed,
      retryAfterSeconds: row.retry_after_seconds ?? 0,
      degraded: false,
    };
  } catch (cause) {
    // لا يُسجَّل المفتاح: قد يكون بريدًا أو معرّف مستخدم
    console.error('[rate-limit] تعذّر العدّاد المشترك، والرجوع إلى الذاكرة', {
      rule,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return checkInMemory(identifier, rule);
  }
}

/** يرمي AppError إذا تجاوز المستخدم الحد */
export async function enforceRateLimit(
  identifier: string,
  rule: RateLimitRule,
): Promise<void> {
  const result = await checkRateLimit(identifier, rule);
  if (!result.allowed) {
    throw new AppError(
      'RATE_LIMITED',
      `عدد كبير من الطلبات. حاول مجددًا بعد ${result.retryAfterSeconds} ثانية.`,
    );
  }
}

/** لأغراض الاختبار */
export function resetRateLimits(): void {
  buckets.clear();
}
