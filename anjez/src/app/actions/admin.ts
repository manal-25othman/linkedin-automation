"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaff } from "@/lib/auth/guard";
import {
  categorySchema,
  couponSchema,
  serviceSchema,
  settingsSchema,
  tierSchema,
  toFieldErrors,
} from "@/lib/validation";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import { SETTING_KEYS, saveSettings } from "@/lib/settings";
import { updateOrderStatus } from "@/lib/orders";
import { normalizeCode } from "@/lib/affiliate/codes";
import { parseRiyalsInput } from "@/lib/money";

// ---------------------------------------------------------------------------
// التصنيفات والخدمات
// ---------------------------------------------------------------------------

export async function saveCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const id = formData.get("id")?.toString() || null;
  const parsed = categorySchema.safeParse({
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    description: formData.get("description") ?? "",
    icon: formData.get("icon") ?? "sparkles",
    sortOrder: formData.get("sortOrder") ?? 0,
    isActive: formData.get("isActive"),
  });

  if (!parsed.success) {
    return formError("تحقّق من الحقول.", toFieldErrors(parsed.error));
  }

  try {
    if (id) {
      await prisma.category.update({ where: { id }, data: parsed.data });
    } else {
      await prisma.category.create({ data: parsed.data });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return formError("الرابط مستخدم لتصنيف آخر.", { slug: "رابط مكرّر" });
    }
    return formError("تعذّر الحفظ.");
  }

  revalidatePath("/admin/categories");
  revalidatePath("/services");
  return formSuccess("حُفظ التصنيف.");
}

export async function saveService(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const id = formData.get("id")?.toString() || null;
  const parsed = serviceSchema.safeParse({
    title: formData.get("title") ?? "",
    slug: formData.get("slug") ?? "",
    summary: formData.get("summary") ?? "",
    description: formData.get("description") ?? "",
    requirements: formData.get("requirements") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    commissionBps: formData.get("commissionPercent") ?? "",
    sortOrder: formData.get("sortOrder") ?? 0,
    isActive: formData.get("isActive"),
    isFeatured: formData.get("isFeatured"),
  });

  if (!parsed.success) {
    return formError("تحقّق من الحقول.", toFieldErrors(parsed.error));
  }

  let serviceId = id;

  try {
    if (id) {
      await prisma.service.update({ where: { id }, data: parsed.data });
    } else {
      const created = await prisma.service.create({ data: parsed.data, select: { id: true } });
      serviceId = created.id;
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return formError("الرابط مستخدم لخدمة أخرى.", { slug: "رابط مكرّر" });
    }
    return formError("تعذّر الحفظ.");
  }

  revalidatePath("/admin/services");
  revalidatePath("/services");
  if (!id && serviceId) redirect(`/admin/services/${serviceId}`);
  return formSuccess("حُفظت الخدمة.");
}

export async function saveTier(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const id = formData.get("id")?.toString() || null;
  const parsed = tierSchema.safeParse({
    serviceId: formData.get("serviceId") ?? "",
    name: formData.get("name") ?? "",
    price: formData.get("price") ?? "",
    deliveryDays: formData.get("deliveryDays") ?? "",
    features: formData.get("features") ?? "",
    sortOrder: formData.get("sortOrder") ?? 0,
    isActive: formData.get("isActive"),
  });

  if (!parsed.success) {
    return formError("تحقّق من بيانات الباقة.", toFieldErrors(parsed.error));
  }

  if (id) {
    await prisma.serviceTier.update({ where: { id }, data: parsed.data });
  } else {
    await prisma.serviceTier.create({ data: parsed.data });
  }

  revalidatePath(`/admin/services/${parsed.data.serviceId}`);
  revalidatePath("/services");
  return formSuccess("حُفظت الباقة.");
}

/**
 * الباقة المرتبطة بطلبات لا تُحذف بل تُعطَّل: حذفها يقطع تاريخ طلبات مدفوعة
 * وعمولات مبنيّة عليها.
 */
export async function deactivateTier(formData: FormData): Promise<void> {
  await requireStaff();
  const id = formData.get("id")?.toString();
  if (!id) return;

  const tier = await prisma.serviceTier.findUnique({
    where: { id },
    select: { serviceId: true, _count: { select: { orders: true } } },
  });
  if (!tier) return;

  if (tier._count.orders === 0) {
    await prisma.serviceTier.delete({ where: { id } });
  } else {
    await prisma.serviceTier.update({ where: { id }, data: { isActive: false } });
  }

  revalidatePath(`/admin/services/${tier.serviceId}`);
}

// ---------------------------------------------------------------------------
// الطلبات
// ---------------------------------------------------------------------------

export async function changeOrderStatus(formData: FormData): Promise<void> {
  const user = await requireStaff();

  const orderId = formData.get("orderId")?.toString();
  const status = formData.get("status")?.toString() as OrderStatus | undefined;
  const note = formData.get("note")?.toString() || undefined;

  if (!orderId || !status) return;

  await updateOrderStatus(orderId, status, user.email, note);

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/commissions");
}

// ---------------------------------------------------------------------------
// المسوّقون
// ---------------------------------------------------------------------------

export async function setAffiliateStatus(formData: FormData): Promise<void> {
  await requireStaff();

  const id = formData.get("affiliateId")?.toString();
  const status = formData.get("status")?.toString();
  if (!id || !status) return;
  if (!["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"].includes(status)) return;

  await prisma.affiliate.update({
    where: { id },
    data: {
      status: status as "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED",
      approvedAt: status === "ACTIVE" ? new Date() : undefined,
    },
  });

  revalidatePath("/admin/affiliates");
  revalidatePath(`/admin/affiliates/${id}`);
}

/** نسبة تفاوضية لمسوّق بعينه — تُلغي نسبة الخدمة ومكافأة المستوى. */
export async function setAffiliateRate(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const id = formData.get("affiliateId")?.toString();
  const raw = formData.get("customPercent")?.toString().trim() ?? "";
  if (!id) return formError("مسوّق غير معروف.");

  let customBps: number | null = null;
  if (raw !== "") {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      return formError("النسبة بين ٠ و ١٠٠.", { customPercent: "نسبة غير صالحة" });
    }
    customBps = Math.round(parsed * 100);
  }

  await prisma.affiliate.update({ where: { id }, data: { customBps } });

  revalidatePath(`/admin/affiliates/${id}`);
  return formSuccess(customBps == null ? "أُلغيت النسبة الخاصة." : "حُفظت النسبة الخاصة.");
}

// ---------------------------------------------------------------------------
// العمولات والسحوبات
// ---------------------------------------------------------------------------

export async function reviewCommission(formData: FormData): Promise<void> {
  await requireStaff();

  const id = formData.get("commissionId")?.toString();
  const decision = formData.get("decision")?.toString();
  if (!id || !decision) return;

  if (decision === "approve") {
    await prisma.commission.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "APPROVED", approvedAt: new Date() },
    });
  } else if (decision === "cancel") {
    await prisma.commission.updateMany({
      // المصروفة لا تُلغى من هنا: صرف المال قرار تسويته إدارية لا تغيير حالة.
      where: { id, status: { in: ["PENDING", "APPROVED"] }, payoutId: null },
      data: { status: "CANCELLED", note: "أُلغيت من الإدارة" },
    });
  }

  revalidatePath("/admin/commissions");
}

export async function processPayout(formData: FormData): Promise<void> {
  await requireStaff();

  const id = formData.get("payoutId")?.toString();
  const decision = formData.get("decision")?.toString();
  const reference = formData.get("reference")?.toString() || null;
  const note = formData.get("note")?.toString() || null;
  if (!id || !decision) return;

  const payout = await prisma.payout.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!payout || payout.status === "PAID") return;

  if (decision === "paid") {
    await prisma.$transaction([
      prisma.payout.update({
        where: { id },
        data: { status: "PAID", processedAt: new Date(), reference, note },
      }),
      prisma.commission.updateMany({
        where: { payoutId: id },
        data: { status: "PAID", paidAt: new Date() },
      }),
    ]);
  } else if (decision === "processing") {
    await prisma.payout.update({ where: { id }, data: { status: "PROCESSING", note } });
  } else if (decision === "reject") {
    // تحرير العمولات من الطلب المرفوض حتى تعود قابلة للسحب في طلب لاحق.
    await prisma.$transaction([
      prisma.payout.update({
        where: { id },
        data: { status: "REJECTED", processedAt: new Date(), note },
      }),
      prisma.commission.updateMany({ where: { payoutId: id }, data: { payoutId: null } }),
    ]);
  }

  revalidatePath("/admin/payouts");
}

// ---------------------------------------------------------------------------
// الكوبونات
// ---------------------------------------------------------------------------

export async function saveCoupon(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const parsed = couponSchema.safeParse({
    code: formData.get("code") ?? "",
    affiliateId: formData.get("affiliateId") ?? "",
    type: formData.get("type") ?? "PERCENT",
    value: formData.get("value") ?? "",
    maxUses: formData.get("maxUses") ?? "",
    expiresAt: formData.get("expiresAt") ?? "",
    isActive: formData.get("isActive"),
  });

  if (!parsed.success) {
    return formError("تحقّق من بيانات الكود.", toFieldErrors(parsed.error));
  }

  const value =
    parsed.data.type === "PERCENT"
      ? Math.round(Number(parsed.data.value) * 100)
      : parseRiyalsInput(parsed.data.value);

  if (value == null || !Number.isFinite(value) || value <= 0) {
    return formError("قيمة الخصم غير صالحة.", { value: "أدخل قيمة صحيحة" });
  }
  if (parsed.data.type === "PERCENT" && value > 10_000) {
    return formError("نسبة الخصم لا تتجاوز ١٠٠٪.", { value: "نسبة كبيرة" });
  }

  const maxUses = parsed.data.maxUses ? Number.parseInt(parsed.data.maxUses, 10) : null;
  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;

  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return formError("تاريخ الانتهاء غير صالح.", { expiresAt: "تاريخ غير صالح" });
  }

  try {
    await prisma.coupon.create({
      data: {
        code: normalizeCode(parsed.data.code),
        affiliateId: parsed.data.affiliateId || null,
        type: parsed.data.type,
        value,
        maxUses: maxUses && maxUses > 0 ? maxUses : null,
        expiresAt,
        isActive: parsed.data.isActive,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return formError("هذا الكود موجود مسبقًا.", { code: "كود مكرّر" });
    }
    return formError("تعذّر إنشاء الكود.");
  }

  revalidatePath("/admin/coupons");
  return formSuccess("أُنشئ كود الخصم.");
}

export async function toggleCoupon(formData: FormData): Promise<void> {
  await requireStaff();
  const id = formData.get("couponId")?.toString();
  if (!id) return;

  const coupon = await prisma.coupon.findUnique({ where: { id }, select: { isActive: true } });
  if (!coupon) return;

  await prisma.coupon.update({ where: { id }, data: { isActive: !coupon.isActive } });
  revalidatePath("/admin/coupons");
}

// ---------------------------------------------------------------------------
// الإعدادات
// ---------------------------------------------------------------------------

export async function saveCommissionSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = settingsSchema.safeParse({
    defaultPercent: formData.get("defaultPercent") ?? "",
    maxPercent: formData.get("maxPercent") ?? "",
    bonusSilverPercent: formData.get("bonusSilverPercent") ?? "",
    bonusGoldPercent: formData.get("bonusGoldPercent") ?? "",
    thresholdSilver: formData.get("thresholdSilver") ?? "",
    thresholdGold: formData.get("thresholdGold") ?? "",
    holdDays: formData.get("holdDays") ?? "",
    attributionWindowDays: formData.get("attributionWindowDays") ?? "",
    minPayout: formData.get("minPayout") ?? "",
    autoApprove: formData.get("autoApprove"),
    contactWhatsapp: formData.get("contactWhatsapp") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
  });

  if (!parsed.success) {
    return formError("تحقّق من القيم.", toFieldErrors(parsed.error));
  }

  const data = parsed.data;

  if (data.defaultPercent == null || data.maxPercent == null) {
    return formError("النسبة الأساسية والسقف مطلوبان.");
  }
  if (data.defaultPercent > data.maxPercent) {
    return formError("النسبة الأساسية أكبر من السقف.", { maxPercent: "السقف أقل من الأساس" });
  }
  if (data.thresholdSilver >= data.thresholdGold) {
    return formError("عتبة الذهبي يجب أن تفوق الفضّي.", { thresholdGold: "عتبة غير منطقية" });
  }

  await saveSettings({
    [SETTING_KEYS.defaultBps]: String(data.defaultPercent),
    [SETTING_KEYS.maxBps]: String(data.maxPercent),
    [SETTING_KEYS.bonusSilver]: String(data.bonusSilverPercent ?? 0),
    [SETTING_KEYS.bonusGold]: String(data.bonusGoldPercent ?? 0),
    [SETTING_KEYS.thresholdSilver]: String(data.thresholdSilver),
    [SETTING_KEYS.thresholdGold]: String(data.thresholdGold),
    [SETTING_KEYS.holdDays]: String(data.holdDays),
    [SETTING_KEYS.attributionWindowDays]: String(data.attributionWindowDays),
    [SETTING_KEYS.minPayout]: String(data.minPayout),
    [SETTING_KEYS.autoApprove]: data.autoApprove ? "true" : "false",
    [SETTING_KEYS.contactWhatsapp]: data.contactWhatsapp ?? "",
    [SETTING_KEYS.contactEmail]: data.contactEmail ?? "",
  });

  revalidatePath("/admin/settings");
  revalidatePath("/affiliate");
  return formSuccess("حُفظت الإعدادات.");
}
