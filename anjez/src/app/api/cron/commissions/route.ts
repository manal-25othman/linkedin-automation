import { NextResponse, type NextRequest } from "next/server";
import { approveDueCommissions } from "@/lib/orders";

/**
 * مهمّة مجدولة (Vercel Cron مثلًا) تعتمد العمولات التي انقضت مدّة تثبيتها.
 * اللوحة تستدعي نفس الدالة عند فتحها، فتعطّل المهمّة يؤخّر الاعتماد ولا يُسقطه.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "cron not configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const approved = await approveDueCommissions();
  return NextResponse.json({ ok: true, approved });
}
