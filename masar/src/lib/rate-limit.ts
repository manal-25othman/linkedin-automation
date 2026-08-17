import 'server-only';

import { AppError } from '@/lib/errors';

/**
 * تحديد معدّل الطلبات — نافذة منزلقة في الذاكرة.
 *
 * ملاحظة معمارية: يعمل لكل نسخة (instance) على حدة، وهو كافٍ لصدّ إساءة
 * الاستخدام العرضية من مستخدم واحد على نشرٍ بنسخة واحدة. للنشر متعدّد
 * النسخ، استبدل المخزن بـ Redis دون تغيير مواقع الاستدعاء — الواجهة هنا
 * مصمَّمة لذلك.
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
    const last = bucket.timestamps[bucket.timestamps.length - 1];
    if (last === undefined || now - last > SWEEP_INTERVAL_MS) buckets.delete(key);
  }
}

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  /** جلب رابط الوظيفة — طلب شبكة خارجي، رخيص لكنه قابل لإساءة الاستخدام كوكيل SSRF */
  jobFetch: { limit: 20, windowMs: 60_000 },
  /** رفع السيرة واستخراج نصها */
  upload: { limit: 15, windowMs: 60_000 },
  /** استدعاءات النموذج — الأغلى تكلفة */
  analysis: { limit: 8, windowMs: 60_000 },
  /** توليد الملفات */
  export: { limit: 30, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(identifier: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(identifier) ?? { timestamps: [] };
  const windowStart = now - rule.windowMs;
  bucket.timestamps = bucket.timestamps.filter((time) => time > windowStart);

  if (bucket.timestamps.length >= rule.limit) {
    buckets.set(identifier, bucket);
    const oldest = bucket.timestamps[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000)),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(identifier, bucket);

  return { allowed: true, remaining: rule.limit - bucket.timestamps.length, retryAfterSeconds: 0 };
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
