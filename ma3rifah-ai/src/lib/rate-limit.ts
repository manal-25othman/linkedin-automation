import 'server-only';

import { AppError } from '@/lib/errors';

/**
 * تحديد معدّل الطلبات — نافذة منزلقة في الذاكرة.
 *
 * ملاحظة معمارية: هذا التطبيق يعمل لكل نسخة (instance) على حدة،
 * وهو كافٍ لصدّ إساءة الاستخدام العرضية من مستخدم واحد. للنشر متعدّد
 * النسخ على Vercel، استبدل RateLimiter بمخزن مشترك (Upstash Redis
 * أو ما يعادله) دون تغيير مواقع الاستدعاء — الواجهة هنا مصمّمة لذلك.
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
    if (bucket.timestamps.length === 0 || now - bucket.timestamps[bucket.timestamps.length - 1] > SWEEP_INTERVAL_MS) {
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
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  identifier: string,
  rule: RateLimitRule,
): RateLimitResult {
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
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000)),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(identifier, bucket);

  return {
    allowed: true,
    remaining: rule.limit - bucket.timestamps.length,
    retryAfterSeconds: 0,
  };
}

/** يرمي AppError إذا تجاوز المستخدم الحد */
export function enforceRateLimit(identifier: string, rule: RateLimitRule): void {
  const result = checkRateLimit(identifier, rule);
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
