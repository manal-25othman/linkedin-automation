import { EDITORIAL_VOICE, HARD_CONSTRAINTS } from "@/lib/editorial-voice";
import { clientKey, pruneRateLimitBuckets, rateLimit } from "@/lib/rate-limit";
import { isFilledText, readField } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * المساعد التحريري — مسوّدات فقط.
 *
 * ثلاث قواعد تحكم هذا الملف:
 * 1. مفتاح Anthropic يُقرأ على الخادم فقط. لا يُعاد في ردّ، ولا يصل المتصفّح.
 * 2. الواجهة مغلقة برمز تشغيلي؛ ليست نقطة عامّة يستهلكها من شاء.
 * 3. المخرَج مسوّدة تُعاد نصًّا عاديًّا. لا يكتب هذا المسار ملفًّا ولا ينشر
 *    شيئًا — النشر فعلٌ بشري عبر المحرّر، بلا استثناء.
 */
const API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const ACCESS_TOKEN = process.env.ASSISTANT_ACCESS_TOKEN ?? "";
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

const TASKS = {
  outline: "اقترح هيكل مقال: العناوين الفرعية، وما يجب أن يُقاس في كل قسم.",
  critique: "راجع المسوّدة الواردة تحريريًّا: ما الادعاء بلا سند، وما القسم الناقص، وما الجملة الترويجية التي تحتاج حذفًا.",
  headlines: "اقترح خمسة عناوين بديلة، ولكل عنوان سبب اختياره في سطر.",
} as const;

type TaskName = keyof typeof TASKS;

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** مقارنة بطول ثابت تتفادى تسريب الرمز عبر توقيت المقارنة. */
function tokenMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(request: Request) {
  if (!API_KEY || !ACCESS_TOKEN) {
    return json({ ok: false, reason: "disabled", message: "المساعد غير مفعّل." }, 503);
  }

  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!tokenMatches(provided, ACCESS_TOKEN)) {
    return json({ ok: false, reason: "unauthorized" }, 401);
  }

  pruneRateLimitBuckets();
  const limit = rateLimit(clientKey(request, "assistant"), 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return json({ ok: false, reason: "rate_limited" }, 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, reason: "bad_request" }, 400);
  }

  const task = readField(body, "task") as TaskName;
  const input = readField(body, "input");
  const sources = Array.isArray((body as Record<string, unknown>)?.sources)
    ? ((body as Record<string, unknown>).sources as unknown[])
        .filter((item): item is string => typeof item === "string")
        .filter((url) => /^https:\/\//.test(url))
        .slice(0, 20)
    : [];

  if (!(task in TASKS) || !isFilledText(input, 40, 40_000)) {
    return json(
      { ok: false, reason: "invalid", message: "مهمّة غير معروفة أو نصّ أقصر من الحدّ." },
      400,
    );
  }

  // نصّ المستخدم يُغلَّف بوسمٍ صريح ويُعلَن غير موثوق، فلا يُقرأ تعليماتٍ.
  const userMessage = [
    `المهمّة: ${TASKS[task]}`,
    "",
    "المصادر المتاحة (لا تستشهد بغيرها):",
    sources.length ? sources.map((url) => `- ${url}`).join("\n") : "- لا مصادر. لا تستشهد بشيء.",
    "",
    "<untrusted_input>",
    input,
    "</untrusted_input>",
  ].join("\n");

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: `${EDITORIAL_VOICE}\n\n${HARD_CONSTRAINTS}`,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!upstream.ok) {
      // حالة المزوّد تكفي للتشخيص؛ جسم الردّ قد يحمل تفاصيل حساب فلا يُعاد.
      console.error("assistant upstream failed", upstream.status);
      return json({ ok: false, reason: "upstream" }, 502);
    }

    const payload = (await upstream.json()) as {
      content?: { type: string; text?: string }[];
    };

    const text = (payload.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("\n")
      .trim();

    return json(
      {
        ok: true,
        // «مسوّدة» ليست وصفًا مجاملًا: لا مسار في هذا المشروع ينشر هذا النصّ.
        status: "draft",
        requiresHumanReview: true,
        task,
        text,
      },
      200,
    );
  } catch (error) {
    console.error("assistant request failed", error);
    return json({ ok: false, reason: "upstream" }, 502);
  }
}
