import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };

/**
 * مخزن داخل الذاكرة: كافٍ لخادم واحد أو عدد محدود من النسخ، وهو الحد الأدنى
 * الذي يمنع الإرسال الآلي المتكرر للنماذج. عند التوسّع أفقيًا يجب استبداله
 * بمخزن مشترك (Redis / Upstash) — انظر PROJECT_AUDIT.md.
 */
const buckets = new Map<string, Bucket>();

/** تنظيف كسول: يمنع نمو الخريطة بلا حدود دون الحاجة إلى مؤقّت. */
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return {
    ok: true,
    remaining: limit - bucket.count,
    retryAfterSeconds: 0,
  };
}

/**
 * عنوان الزائر خلف بروكسي. لا يُخزَّن خامًا في أي مكان — يُهشَّم قبل الحفظ
 * حتى لا نحتفظ ببيانات شخصية أكثر مما يلزم لمنع السبام.
 */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headerList.get("x-real-ip")?.trim() || "unknown";
}

export function hashIp(ip: string): string {
  const salt = process.env.AUTH_SECRET ?? "anjez";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * يتحقق أن الطلب صادر من نفس الأصل. Server Actions في Next تفحص الأصل تلقائيًا،
 * وهذه الدالة تغطي Route Handlers التي تستقبل بيانات من النماذج.
 */
export async function isSameOrigin(): Promise<boolean> {
  const headerList = await headers();
  const origin = headerList.get("origin");
  const host = headerList.get("host");

  // طلبات التنقل العادية (GET) قد لا تحمل Origin؛ الفحص يخصّ الطلبات المُعدِّلة.
  if (!origin) return true;
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
