import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";

/**
 * الحماية الحقيقية تتم هنا — في مكان قراءة البيانات — لا في الـ middleware وحده.
 * الـ middleware يمنع الوصول مبكرًا فقط، وقد يُتجاوز بمسار لا يمرّ به.
 */
export async function requireStaff(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF")) {
    redirect("/admin/login");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireStaff();
  if (user.role !== "ADMIN") {
    redirect("/admin?error=forbidden");
  }
  return user;
}

/** حساب مسوّق مفعّل. الحسابات المعلّقة تُوجَّه لصفحة الحالة لا للوحة. */
export async function requireAffiliateUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "AFFILIATE") {
    redirect("/partner/login");
  }
  return user;
}
