import "server-only";

/**
 * حدّ معدّل بسيط في الذاكرة.
 *
 * حدوده معروفة ومقصودة: الذاكرة لا تُشارَك بين نسخ الدالة عديمة الحالة، ولا
 * تنجو من إعادة التشغيل. فهو يوقف التكرار الآلي الفجّ من عميل واحد، ولا يصلح
 * حاجزًا أمام هجوم موزّع. الحاجز الجادّ يكون عند الحافّة (Vercel WAF) أو
 * بمخزن مشترك.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);

  if (bucket.count > limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds };
}

/** يقرأ عنوان العميل من ترويسات الوكيل العكسي، ويعود إلى قيمة محايدة عند غيابها. */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}

/** تنظيف دوري كي لا تنمو الخريطة بلا حدّ في عملية طويلة العمر. */
export function pruneRateLimitBuckets(now = Date.now()): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
