import { clientKey, pruneRateLimitBuckets, rateLimit } from "@/lib/rate-limit";
import { isValidEmail, readField } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * تسجيل الاشتراك في النشرة.
 *
 * العنوان والمفتاح يبقيان على الخادم: المتصفّح لا يرى مزوّد النشرة ولا مفتاحه.
 * وإن لم يُضبط المزوّد بعد، تُعيد الواجهة 503 صراحةً — لا نُظهر رسالة نجاح
 * لاشتراك لم يُسجَّل.
 */
const PROVIDER_ENDPOINT = process.env.NEWSLETTER_ENDPOINT ?? "";
const PROVIDER_TOKEN = process.env.NEWSLETTER_API_KEY ?? "";

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function POST(request: Request) {
  if (!PROVIDER_ENDPOINT) {
    return json(
      { ok: false, reason: "disabled", message: "الاشتراك بالبريد غير مفعّل بعد." },
      503,
    );
  }

  pruneRateLimitBuckets();
  const limit = rateLimit(clientKey(request, "newsletter"), 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return json(
      { ok: false, reason: "rate_limited", message: "محاولات كثيرة. جرّب بعد قليل." },
      429,
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, reason: "bad_request", message: "طلب غير صالح." }, 400);
  }

  // حقل فخّ: البشر لا يملؤونه، والروبوتات تملؤه. نردّ بنجاح ظاهري ولا نسجّل شيئًا.
  if (readField(body, "company")) {
    return json({ ok: true }, 200);
  }

  const email = readField(body, "email");
  if (!isValidEmail(email)) {
    return json({ ok: false, reason: "invalid_email", message: "بريد غير صالح." }, 400);
  }

  try {
    const upstream = await fetch(PROVIDER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(PROVIDER_TOKEN ? { Authorization: `Bearer ${PROVIDER_TOKEN}` } : {}),
      },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      // لا نُسرّب جسم ردّ المزوّد إلى المتصفّح؛ قد يحمل تفاصيل حساب.
      console.error("newsletter upstream failed", upstream.status);
      return json(
        { ok: false, reason: "upstream", message: "تعذّر تسجيل الاشتراك الآن." },
        502,
      );
    }

    return json({ ok: true }, 200);
  } catch (error) {
    console.error("newsletter request failed", error);
    return json({ ok: false, reason: "upstream", message: "تعذّر تسجيل الاشتراك الآن." }, 502);
  }
}
