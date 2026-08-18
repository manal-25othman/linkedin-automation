"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { requireAffiliateUser } from "@/lib/auth/guard";
import { affiliateSignupSchema, payoutDetailsSchema, toFieldErrors } from "@/lib/validation";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { randomCode, suggestCode } from "@/lib/affiliate/codes";
import { canRequestPayout, summarizeBalances } from "@/lib/affiliate/commission";
import { getSettings } from "@/lib/settings";

/** ينشئ حساب المسوّق مع ملفّه وكوده، ثم يفتح له جلسة مباشرة. */
export async function registerAffiliate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await getClientIp();
  if (!rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000).ok) {
    return formError("محاولات تسجيل كثيرة. حاول بعد قليل.");
  }

  const parsed = affiliateSignupSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    password: formData.get("password") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
    promotionPlan: formData.get("promotionPlan") ?? "",
    acceptTerms: formData.get("acceptTerms") ?? "",
  });

  if (!parsed.success) {
    return formError("تحقّق من الحقول أدناه.", toFieldErrors(parsed.error));
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) {
    return formError("هذا البريد مسجّل مسبقًا.", { email: "البريد مستخدم — سجّل الدخول بدلًا من ذلك" });
  }

  const passwordHash = await hashPassword(parsed.data.password);

  let userId: string | null = null;

  // إعادة المحاولة تغطي تصادم الكود المقترح مع كود مسوّق آخر.
  for (let attempt = 0; attempt < 5 && !userId; attempt += 1) {
    const code = attempt === 0 ? suggestCode(parsed.data.name) : randomCode(7);

    try {
      const user = await prisma.user.create({
        data: {
          email: parsed.data.email,
          name: parsed.data.name,
          phone: parsed.data.phone,
          passwordHash,
          role: "AFFILIATE",
          affiliate: {
            create: {
              code,
              promotionPlan: parsed.data.promotionPlan,
            },
          },
        },
        select: { id: true },
      });
      userId = user.id;
    } catch (error) {
      const isClash =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!isClash) return formError("تعذّر إنشاء الحساب. حاول مرة أخرى.");
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const target = String(error.meta?.target ?? "");
        if (target.includes("email")) {
          return formError("هذا البريد مسجّل مسبقًا.", { email: "البريد مستخدم" });
        }
      }
    }
  }

  if (!userId) return formError("تعذّر إنشاء الحساب. حاول مرة أخرى.");

  await createSession(userId, { ip });
  redirect("/partner");
}

export async function savePayoutDetails(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAffiliateUser();

  const parsed = payoutDetailsSchema.safeParse({
    payoutMethod: formData.get("payoutMethod") ?? "",
    beneficiaryName: formData.get("beneficiaryName") ?? "",
    iban: formData.get("iban") ?? "",
    bankName: formData.get("bankName") ?? "",
  });

  if (!parsed.success) {
    return formError("تحقّق من بيانات الحساب.", toFieldErrors(parsed.error));
  }

  await prisma.affiliate.update({
    where: { userId: user.id },
    data: {
      payoutMethod: parsed.data.payoutMethod,
      beneficiaryName: parsed.data.beneficiaryName,
      iban: parsed.data.iban,
      bankName: parsed.data.bankName,
    },
  });

  revalidatePath("/partner/payouts");
  return formSuccess("حُفظت بيانات التحويل.");
}

/**
 * يطلب صرف الرصيد المعتمد. العمولات المشمولة تُربط بالطلب في نفس المعاملة،
 * فلا يستطيع طلبان متزامنان حجز نفس العمولة مرتين.
 */
export async function requestPayout(_prev: FormState): Promise<FormState> {
  const user = await requireAffiliateUser();
  const settings = await getSettings();

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      status: true,
      payoutMethod: true,
      beneficiaryName: true,
      iban: true,
      bankName: true,
    },
  });

  if (!affiliate) return formError("لم نعثر على ملفّ المسوّق.");
  if (affiliate.status !== "ACTIVE") {
    return formError("حسابك غير مفعّل حاليًا، فلا يمكن طلب السحب.");
  }
  if (!affiliate.iban || !affiliate.beneficiaryName) {
    return formError("أضف بيانات التحويل (اسم المستفيد والآيبان) قبل طلب السحب.");
  }

  const commissions = await prisma.commission.findMany({
    where: { affiliateId: affiliate.id, status: "APPROVED", payoutId: null },
    select: { id: true, amount: true, status: true, payoutId: true },
  });

  const { available } = summarizeBalances(commissions);
  const check = canRequestPayout(available, settings.commission);
  if (!check.ok) return formError(check.reason);

  await prisma.$transaction(async (tx) => {
    const payout = await tx.payout.create({
      data: {
        affiliateId: affiliate.id,
        amount: available,
        method: affiliate.payoutMethod,
        beneficiarySnapshot: [
          affiliate.beneficiaryName,
          affiliate.iban,
          affiliate.bankName || null,
        ]
          .filter(Boolean)
          .join(" — "),
      },
      select: { id: true },
    });

    await tx.commission.updateMany({
      where: { id: { in: commissions.map((c) => c.id) }, payoutId: null, status: "APPROVED" },
      data: { payoutId: payout.id },
    });
  });

  revalidatePath("/partner/payouts");
  revalidatePath("/partner");
  return formSuccess("أُرسل طلب السحب. سيُحوَّل المبلغ خلال أيام العمل القادمة.");
}
