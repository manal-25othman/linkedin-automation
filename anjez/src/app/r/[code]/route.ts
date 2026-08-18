import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { normalizeCode } from "@/lib/affiliate/codes";
import { encodeRefValue, REF_COOKIE, recordClick } from "@/lib/affiliate/attribution";
import { hashIp } from "@/lib/rate-limit";

/**
 * رابط الإحالة القصير: /r/CODE?to=/services/xyz
 * يسجّل النقرة، يضع الكوكي، ثم يحوّل الزائر لوجهته — كل ذلك في طلب واحد
 * حتى لا يرى الزائر صفحة وسيطة.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await context.params;
  const code = normalizeCode(rawCode);

  const requestedPath = request.nextUrl.searchParams.get("to") ?? "/";
  // مسارات داخلية فقط — يمنع تحويل الزائر إلى نطاق خارجي عبر رابط إحالة.
  const target =
    requestedPath.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/";

  const destination = new URL(target, request.nextUrl.origin);

  const affiliate = code
    ? await prisma.affiliate
        .findUnique({ where: { code }, select: { id: true, code: true, status: true } })
        .catch(() => null)
    : null;

  const response = NextResponse.redirect(destination);

  if (!affiliate || affiliate.status !== "ACTIVE") {
    return response;
  }

  const { commission } = await getSettings();

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

  await recordClick({
    affiliateId: affiliate.id,
    code: affiliate.code,
    landingPath: target,
    referer: request.headers.get("referer"),
    ipHash: hashIp(ip),
    userAgent: request.headers.get("user-agent"),
  });

  response.cookies.set(REF_COOKIE, encodeRefValue(affiliate.code), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: commission.attributionWindowDays * 24 * 60 * 60,
  });

  return response;
}
