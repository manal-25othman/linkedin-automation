"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { dummyPasswordCompare, hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  destroySession,
  getCurrentUser,
  pruneExpiredSessions,
} from "@/lib/auth/session";
import { changePasswordSchema, loginSchema, toFieldErrors } from "@/lib/validation";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const INVALID_CREDENTIALS = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";

/** مسارات داخلية فقط، وضمن المساحة التي يملكها الدور — لا إعادة توجيه مفتوحة. */
function safeRedirectPath(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("/login") || value.includes("/register")) return fallback;
  if (fallback.startsWith("/admin") && !value.startsWith("/admin")) return fallback;
  if (fallback.startsWith("/partner") && !value.startsWith("/partner")) return fallback;
  return value;
}

async function authenticate(
  formData: FormData,
  area: "admin" | "partner",
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });

  if (!parsed.success) {
    return formError("تحقّق من البيانات المُدخلة.", toFieldErrors(parsed.error));
  }

  const ip = await getClientIp();

  // حدّان: لكل عنوان اتصال ولكل بريد — حتى لا يُجرَّب حساب واحد من عناوين كثيرة،
  // ولا حسابات كثيرة من عنوان واحد.
  const byIp = rateLimit(`login:ip:${ip}`, 10, 15 * 60 * 1000);
  const byEmail = rateLimit(`login:email:${parsed.data.email}`, 5, 15 * 60 * 1000);

  if (!byIp.ok || !byEmail.ok) {
    return formError("محاولات كثيرة. انتظر بضع دقائق ثم أعد المحاولة.");
  }

  const user = await prisma.user
    .findUnique({
      where: { email: parsed.data.email },
      select: { id: true, passwordHash: true, isActive: true, role: true },
    })
    .catch(() => null);

  if (!user) {
    await dummyPasswordCompare();
    return formError(INVALID_CREDENTIALS);
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid || !user.isActive) return formError(INVALID_CREDENTIALS);

  const belongsToArea =
    area === "admin" ? user.role === "ADMIN" || user.role === "STAFF" : user.role === "AFFILIATE";

  // نفس الرسالة: لا نكشف أن البريد صحيح لكنه لدور آخر.
  if (!belongsToArea) return formError(INVALID_CREDENTIALS);

  const headerList = await headers();
  await pruneExpiredSessions();
  await createSession(user.id, { userAgent: headerList.get("user-agent"), ip });

  await prisma.user
    .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    .catch(() => undefined);

  redirect(
    safeRedirectPath(formData.get("next")?.toString(), area === "admin" ? "/admin" : "/partner"),
  );
}

export async function loginAdmin(_prev: FormState, formData: FormData): Promise<FormState> {
  return authenticate(formData, "admin");
}

export async function loginPartner(_prev: FormState, formData: FormData): Promise<FormState> {
  return authenticate(formData, "partner");
}

export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  const target = user?.role === "AFFILIATE" ? "/partner/login" : "/admin/login";
  await destroySession();
  redirect(target);
}

export async function changePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return formError("انتهت الجلسة. سجّل الدخول من جديد.");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });

  if (!parsed.success) {
    return formError("تحقّق من الحقول أدناه.", toFieldErrors(parsed.error));
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) return formError("تعذّر العثور على الحساب.");

  const valid = await verifyPassword(parsed.data.currentPassword, record.passwordHash);
  if (!valid) {
    return formError("كلمة المرور الحالية غير صحيحة.", {
      currentPassword: "كلمة المرور الحالية غير صحيحة",
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });

  // تغيير كلمة المرور يُخرج كل الأجهزة الأخرى.
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await destroySession();

  return formSuccess("تم تغيير كلمة المرور وإنهاء الجلسات. سجّل الدخول من جديد.");
}
