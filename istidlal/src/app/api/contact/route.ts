import { clientKey, pruneRateLimitBuckets, rateLimit } from "@/lib/rate-limit";
import { isFilledText, isValidEmail, readField } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * استقبال رسائل نموذج التواصل وتحويلها بريدًا.
 *
 * التسليم عبر Resend حين يُضبط المفتاح على الخادم. المفتاح لا يُقرأ في
 * المتصفّح أبدًا، ولا يُعاد أيّ تفصيل من ردّ المزوّد إلى المرسِل.
 */
const RESEND_KEY = process.env.RESEND_API_KEY ?? "";
const TO_EMAIL = process.env.CONTACT_TO_EMAIL ?? "";
const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL ?? "";

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** يمنع حقن الترويسات عبر حقول يتحكّم فيها المرسِل. */
function singleLine(value: string, max: number): string {
  return value.replace(/[\r\n]+/g, " ").slice(0, max);
}

/** نصّ عادي لا HTML: لا نبني رسالة من مدخل مستخدم ثم نصيّرها. */
function plainBody(fields: { name: string; email: string; subject: string; message: string }) {
  return [
    `الاسم: ${fields.name}`,
    `البريد: ${fields.email}`,
    `الموضوع: ${fields.subject}`,
    "",
    fields.message,
  ].join("\n");
}

export async function POST(request: Request) {
  if (!RESEND_KEY || !TO_EMAIL || !FROM_EMAIL) {
    return json(
      { ok: false, reason: "disabled", message: "نموذج المراسلة غير مفعّل بعد." },
      503,
    );
  }

  pruneRateLimitBuckets();
  const limit = rateLimit(clientKey(request, "contact"), 3, 60 * 60 * 1000);
  if (!limit.allowed) {
    return json(
      { ok: false, reason: "rate_limited", message: "رسائل كثيرة. جرّب بعد قليل." },
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

  if (readField(body, "company")) {
    return json({ ok: true }, 200);
  }

  const name = readField(body, "name");
  const email = readField(body, "email");
  const subject = readField(body, "subject");
  const message = readField(body, "message");

  if (
    !isFilledText(name, 2, 80) ||
    !isValidEmail(email) ||
    !isFilledText(subject, 3, 120) ||
    !isFilledText(message, 20, 5000)
  ) {
    return json(
      { ok: false, reason: "invalid", message: "راجع الحقول: كل الحقول مطلوبة والرسالة ٢٠ حرفًا فأكثر." },
      400,
    );
  }

  try {
    const upstream = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: email,
        subject: singleLine(`[استدلال] ${subject}`, 150),
        text: plainBody({
          name: singleLine(name, 80),
          email: singleLine(email, 254),
          subject: singleLine(subject, 120),
          message,
        }),
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) {
      console.error("contact upstream failed", upstream.status);
      return json({ ok: false, reason: "upstream", message: "تعذّر إرسال الرسالة الآن." }, 502);
    }

    return json({ ok: true }, 200);
  } catch (error) {
    console.error("contact request failed", error);
    return json({ ok: false, reason: "upstream", message: "تعذّر إرسال الرسالة الآن." }, 502);
  }
}
