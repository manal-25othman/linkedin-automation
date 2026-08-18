import { z } from "zod";
import { isValidSlug } from "@/lib/slug";
import { parseRiyalsInput } from "@/lib/money";

export type FieldErrors = Record<string, string>;

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

/** حقل سعر يُدخل بالريالات ويُخزَّن بالهللات. */
const priceField = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const halalas = parseRiyalsInput(value);
    if (halalas == null) {
      ctx.addIssue({ code: "custom", message: "أدخل مبلغًا صحيحًا بالريال" });
      return z.NEVER;
    }
    return halalas;
  });

/** نسبة تُدخل بالمئة (15) وتُخزَّن bps (1500). */
const percentField = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const parsed = Number(value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      ctx.addIssue({ code: "custom", message: "النسبة بين ٠ و ١٠٠" });
      return z.NEVER;
    }
    return Math.round(parsed * 100);
  });

/**
 * أرقام الجوال السعودية بصيغها المتداولة: 05xxxxxxxx و 9665xxxxxxxx و +9665xxxxxxxx.
 * التطبيع إلى صيغة واحدة يمنع تكرار العميل نفسه بثلاثة سجلّات مختلفة.
 */
export const saudiPhone = z
  .string()
  .trim()
  .transform((value) =>
    value
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[\s()-]/g, ""),
  )
  .refine(
    (value) => /^(?:\+?966|0)?5\d{8}$/.test(value),
    "رقم الجوال غير صحيح — مثال: 0512345678",
  )
  .transform((value) => {
    const digits = value.replace(/^\+?966/, "").replace(/^0/, "");
    return `+966${digits}`;
  });

// ---------------------------------------------------------------------------
// المصادقة
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(1, "كلمة المرور مطلوبة").max(200),
});

export const passwordSchema = z
  .string()
  .min(10, "كلمة المرور يجب ألا تقل عن ١٠ أحرف")
  .max(200, "كلمة المرور طويلة جدًا")
  .refine((v) => /[a-zA-Z]/.test(v), "يجب أن تحتوي على حرف")
  .refine((v) => /[0-9]/.test(v), "يجب أن تحتوي على رقم");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  });

// ---------------------------------------------------------------------------
// انضمام المسوّق
// ---------------------------------------------------------------------------

export const affiliateSignupSchema = z
  .object({
    name: z.string().trim().min(3, "الاسم مطلوب").max(80),
    email: z.string().trim().toLowerCase().email("البريد الإلكتروني غير صالح"),
    phone: saudiPhone,
    password: passwordSchema,
    confirmPassword: z.string(),
    promotionPlan: z
      .string()
      .trim()
      .min(20, "اكتب سطرين على الأقل عن قنواتك التسويقية")
      .max(1000),
    acceptTerms: z.literal("on", { message: "الموافقة على شروط البرنامج مطلوبة" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  });

export const payoutDetailsSchema = z.object({
  payoutMethod: z.enum(["BANK", "STC_PAY"], { message: "اختر وسيلة الصرف" }),
  beneficiaryName: z.string().trim().min(3, "اسم المستفيد مطلوب").max(120),
  iban: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v.replace(/\s/g, ""))
    .refine(
      (v) => /^SA\d{22}$/.test(v) || /^\+?9665\d{8}$/.test(v),
      "أدخل آيبان سعودي (SA + ٢٢ رقمًا) أو رقم محفظة STC Pay",
    ),
  bankName: z.string().trim().max(120).optional().default(""),
});

// ---------------------------------------------------------------------------
// الطلب
// ---------------------------------------------------------------------------

export const orderSchema = z.object({
  tierId: z.string().trim().min(1, "اختر الباقة"),
  customerName: z.string().trim().min(3, "الاسم مطلوب").max(80),
  customerPhone: saudiPhone,
  customerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .optional()
    .default("")
    .refine(
      (v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
      "البريد الإلكتروني غير صالح",
    ),
  notes: z.string().trim().max(2000).optional().default(""),
  couponCode: z.string().trim().max(40).optional().default(""),
});

export const trackOrderSchema = z.object({
  orderNumber: z.string().trim().min(6, "رقم الطلب مطلوب").max(40),
  phone: saudiPhone,
});

// ---------------------------------------------------------------------------
// لوحة الأدمن
// ---------------------------------------------------------------------------

export const categorySchema = z.object({
  name: z.string().trim().min(2, "اسم التصنيف مطلوب").max(80),
  slug: z.string().trim().min(2, "الرابط مطلوب").max(96).refine(isValidSlug, "رابط غير صالح"),
  description: z.string().trim().max(300).optional().default(""),
  icon: z.string().trim().max(40).optional().default("sparkles"),
  sortOrder: z.coerce.number().int().min(0).max(999).optional().default(0),
  isActive: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export const serviceSchema = z.object({
  title: z.string().trim().min(4, "عنوان الخدمة مطلوب").max(120),
  slug: z.string().trim().min(2, "الرابط مطلوب").max(96).refine(isValidSlug, "رابط غير صالح"),
  summary: z.string().trim().min(10, "اكتب وصفًا مختصرًا").max(300),
  description: z.string().trim().max(5000).optional().default(""),
  requirements: z.string().trim().max(2000).optional().default(""),
  categoryId: z.string().trim().min(1, "اختر التصنيف"),
  commissionBps: percentField,
  sortOrder: z.coerce.number().int().min(0).max(999).optional().default(0),
  isActive: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  isFeatured: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export const tierSchema = z.object({
  serviceId: z.string().trim().min(1),
  name: z.string().trim().min(2, "اسم الباقة مطلوب").max(60),
  price: priceField,
  deliveryDays: z.coerce.number().int().min(1, "مدة التنفيذ يوم على الأقل").max(120),
  features: z.string().trim().max(1000).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).max(99).optional().default(0),
  isActive: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "الكود قصير")
    .max(24)
    .regex(/^[A-Z0-9]+$/, "الكود يقبل الحروف اللاتينية والأرقام فقط"),
  affiliateId: z.string().trim().optional().default(""),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.string().trim().min(1, "القيمة مطلوبة"),
  maxUses: z.string().trim().optional().default(""),
  expiresAt: z.string().trim().optional().default(""),
  isActive: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export const settingsSchema = z.object({
  defaultPercent: percentField,
  maxPercent: percentField,
  bonusSilverPercent: percentField,
  bonusGoldPercent: percentField,
  thresholdSilver: priceField,
  thresholdGold: priceField,
  holdDays: z.coerce.number().int().min(0).max(180),
  attributionWindowDays: z.coerce.number().int().min(1).max(365),
  minPayout: priceField,
  autoApprove: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  contactWhatsapp: z.string().trim().max(40).optional().default(""),
  contactEmail: z.string().trim().max(160).optional().default(""),
});
