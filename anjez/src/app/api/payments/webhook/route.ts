import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { markOrderPaid } from "@/lib/orders";

/** مقارنة ثابتة الزمن حتى لا يُستدلّ على السرّ من فروق التوقيت. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type MoyasarWebhook = {
  type?: string;
  secret_token?: string;
  data?: {
    id?: string;
    status?: string;
    metadata?: Record<string, string> | null;
  };
};

/**
 * إشعار الدفع من البوّابة. البوّابات تُعيد الإرسال عند أي تأخّر في الرد، ولهذا
 * `markOrderPaid` مكتوبة لتكون idempotent — التكرار لا يُنشئ عمولة ثانية.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.MOYASAR_WEBHOOK_SECRET?.trim();
  if (!expected) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }

  let payload: MoyasarWebhook;
  try {
    payload = (await request.json()) as MoyasarWebhook;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const provided = payload.secret_token ?? request.headers.get("x-webhook-token") ?? "";
  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const isPaid =
    payload.type === "payment_paid" ||
    payload.type === "invoice_paid" ||
    payload.data?.status === "paid";

  const orderNumber = payload.data?.metadata?.order_number;

  if (!isPaid || !orderNumber) {
    // نردّ 200 على الأحداث غير المعنيّة كي لا تُعيد البوّابة إرسالها بلا نهاية.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await markOrderPaid(orderNumber, {
    provider: "moyasar",
    reference: payload.data?.id ?? "unknown",
  });

  if (!result.ok) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, alreadyPaid: result.alreadyPaid ?? false });
}
