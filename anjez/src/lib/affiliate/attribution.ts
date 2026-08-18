import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { isClickWithinWindow } from "@/lib/affiliate/commission";
import {
  REF_COOKIE,
  REF_QUERY_PARAM,
  decodeRefValue,
  encodeRefValue,
} from "@/lib/affiliate/code-format";

// إعادة تصدير لتبقى نقطة استيراد واحدة لمن يتعامل مع الإحالة من جهة الخادم.
export { REF_COOKIE, REF_QUERY_PARAM, encodeRefValue, decodeRefValue };

export async function setReferralCookie(code: string, windowDays: number): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(REF_COOKIE, encodeRefValue(code), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: windowDays * 24 * 60 * 60,
  });
}

export async function clearReferralCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(REF_COOKIE, "", { path: "/", maxAge: 0 });
}

export type ReferralContext = {
  affiliateId: string;
  code: string;
  affiliateName: string;
} | null;

/**
 * يقرأ الكوكي ويتحقّق أن المسوّق ما يزال مفعّلًا وأن النقرة داخل النافذة.
 * التحقّق يتم وقت إنشاء الطلب لا وقت النقر: مسوّق أُوقف بعد نشره الرابط
 * يجب ألا يكسب عمولة على بيع لاحق.
 */
export async function getReferralContext(): Promise<ReferralContext> {
  const cookieStore = await cookies();
  const decoded = decodeRefValue(cookieStore.get(REF_COOKIE)?.value);
  if (!decoded) return null;

  const { commission } = await getSettings();
  if (!isClickWithinWindow(decoded.clickedAt, new Date(), commission.attributionWindowDays)) {
    return null;
  }

  const affiliate = await prisma.affiliate
    .findUnique({
      where: { code: decoded.code },
      select: { id: true, code: true, status: true, user: { select: { name: true } } },
    })
    .catch(() => null);

  if (!affiliate || affiliate.status !== "ACTIVE") return null;

  return {
    affiliateId: affiliate.id,
    code: affiliate.code,
    affiliateName: affiliate.user.name,
  };
}

/** يسجّل النقرة. الفشل لا يُوقف تحويل الزائر — التتبّع أقل أهمية من الزيارة. */
export async function recordClick(input: {
  affiliateId: string;
  code: string;
  landingPath: string;
  referer?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await prisma.referralClick
    .create({
      data: {
        affiliateId: input.affiliateId,
        code: input.code,
        landingPath: input.landingPath.slice(0, 300),
        referer: input.referer?.slice(0, 300) ?? null,
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent?.slice(0, 255) ?? null,
      },
    })
    .catch(() => undefined);
}
