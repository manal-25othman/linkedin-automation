import { z } from 'zod';

/**
 * مخططات التحقق — تُستخدم على الخادم دائمًا، وعلى الواجهة اختياريًا.
 * التحقق على الواجهة تحسين لتجربة الاستخدام، والتحقق على الخادم هو الحارس الفعلي.
 */

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} مطلوب.`)
    .max(max, `${label} طويل جدًا (الحد الأقصى ${max} حرفًا).`);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'البريد الإلكتروني مطلوب.')
  .email('صيغة البريد الإلكتروني غير صحيحة.')
  .max(255);

export const passwordSchema = z
  .string()
  .min(8, 'كلمة المرور يجب ألا تقل عن 8 أحرف.')
  .max(72, 'كلمة المرور طويلة جدًا.')
  .regex(/[a-zA-Z؀-ۿ]/, 'كلمة المرور يجب أن تحتوي على حرف واحد على الأقل.')
  .regex(/[0-9]/, 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل.');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'كلمة المرور مطلوبة.'),
});

export const registerSchema = z.object({
  fullName: trimmed(2, 120, 'الاسم الكامل'),
  email: emailSchema,
  password: passwordSchema,
  companyName: trimmed(2, 150, 'اسم الشركة'),
  jobTitle: z.string().trim().max(120).optional().or(z.literal('')),
  // الرمز اختياري في المخطّط ومطلوب في الإجراء حسب وضع التسجيل:
  // المخطّط لا يعرف الإعداد، والتحقّق الحقيقي على الخادم لا هنا.
  inviteCode: z.string().trim().max(64).optional().or(z.literal('')),
});

export const contactSchema = z.object({
  fullName: trimmed(2, 120, 'الاسم الكامل'),
  email: emailSchema,
  companyName: trimmed(2, 150, 'اسم الشركة'),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  companySize: z.string().trim().max(50).optional().or(z.literal('')),
  message: trimmed(5, 4000, 'الرسالة'),
});

export const departmentSchema = z.object({
  name: trimmed(2, 100, 'اسم القسم'),
  code: z.string().trim().max(20).optional().or(z.literal('')),
  description: z.string().trim().max(500).optional().or(z.literal('')),
});

export const categorySchema = z.object({
  name: trimmed(2, 100, 'اسم التصنيف'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  color: z.string().trim().max(20).optional().or(z.literal('')),
});

export const userInviteSchema = z.object({
  fullName: trimmed(2, 120, 'الاسم الكامل'),
  email: emailSchema,
  role: z.enum(['COMPANY_ADMIN', 'MANAGER', 'EMPLOYEE']),
  departmentId: z.string().uuid().nullable().optional(),
  jobTitle: z.string().trim().max(120).optional().or(z.literal('')),
});

export const userUpdateSchema = z.object({
  userId: z.string().uuid(),
  fullName: trimmed(2, 120, 'الاسم الكامل'),
  role: z.enum(['COMPANY_ADMIN', 'MANAGER', 'EMPLOYEE']),
  departmentId: z.string().uuid().nullable().optional(),
  jobTitle: z.string().trim().max(120).optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'DISABLED']),
});

export const documentMetadataSchema = z.object({
  name: trimmed(2, 200, 'اسم المستند'),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  categoryId: z.string().uuid().nullable().optional(),
  visibility: z.enum(['COMPANY', 'DEPARTMENT', 'ROLE']),
  allowedDepartmentIds: z.array(z.string().uuid()).default([]),
  allowedRoles: z.array(z.enum(['COMPANY_ADMIN', 'MANAGER', 'EMPLOYEE'])).default([]),
});

export const knowledgeGapUpdateSchema = z.object({
  gapId: z.string().uuid(),
  status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED']),
  resolutionNote: z.string().trim().max(2000).optional().or(z.literal('')),
  linkedDocumentId: z.string().uuid().nullable().optional(),
  /** الإجابة المعتمدة — تدخل قاعدة المعرفة فيجدها البحث */
  answerText: z.string().trim().max(8000).optional().or(z.literal('')),
});

export const aiSettingsSchema = z.object({
  tone: z.enum(['professional', 'friendly', 'concise']),
  retrieval_top_k: z.number().int().min(3).max(20),
  min_similarity: z.number().min(0.01).max(0.95),
  max_context_chunks: z.number().int().min(2).max(12),
  history_window: z.number().int().min(0).max(20),
  allow_general_knowledge: z.boolean(),
});

export const askSchema = z.object({
  question: z
    .string()
    .trim()
    .min(2, 'اكتب سؤالك أولًا.')
    .max(2000, 'السؤال طويل جدًا (الحد الأقصى 2000 حرف).'),
  conversationId: z.string().uuid().nullable().optional(),
});

/**
 * حدّ خطة: رقم موجب، أو «بلا حد».
 *
 * الحقل الفارغ يعني «بلا حد» (null) لا صفرًا — والفرق ليس تجميليًا:
 * الصفر يمنع كل استخدام، فخطأ في القراءة هنا يوقف شركة كاملة عن العمل.
 * ولهذا يُرفض الصفر صراحةً بدل أن يُقبل ويُفسَّر.
 */
const planLimit = z
  .union([z.literal(''), z.coerce.number().int().positive('الحدود يجب أن تكون أرقامًا موجبة.')])
  .transform((value) => (value === '' ? null : value));

export const planUpsertSchema = z
  .object({
    planId: z.string().uuid().nullable().optional(),
    code: z
      .string()
      .trim()
      .min(2, 'رمز الخطة قصير جدًا.')
      .max(30, 'رمز الخطة طويل جدًا.')
      // القيد نفسه مفروض في قاعدة البيانات؛ تكراره هنا يعطي رسالة عربية
      // بدل خطأ Postgres خام.
      .regex(/^[A-Z_]+$/, 'رمز الخطة بحروف إنجليزية كبيرة وشرطة سفلية فقط (مثل: STARTER).'),
    name: z.string().trim().min(2, 'اسم الخطة مطلوب.').max(60, 'اسم الخطة طويل جدًا.'),
    description: z.string().trim().max(300, 'الوصف طويل جدًا.').optional().default(''),
    priceAmount: z
      .union([z.literal(''), z.coerce.number().min(0, 'السعر لا يكون سالبًا.').max(9_999_999)])
      .transform((value) => (value === '' ? null : value)),
    currency: z.string().trim().length(3, 'رمز العملة من ثلاثة أحرف (مثل: SAR).').toUpperCase(),
    maxUsers: planLimit,
    maxDocuments: planLimit,
    maxQuestionsMonthly: planLimit,
    maxStorageMb: planLimit,
    /** ميزة في كل سطر — أسهل ما يُحرَّر في حقل نصّي */
    features: z.string().max(2000, 'قائمة المزايا طويلة جدًا.').optional().default(''),
    isPublic: z.boolean(),
    isCustomPriced: z.boolean(),
    sortOrder: z.coerce.number().int().min(0).max(999),
  })
  .refine((value) => value.isCustomPriced || value.priceAmount !== null, {
    // خطة معروضة بسعر فارغ تظهر للزائر بلا سعر ولا «حسب الطلب» — فراغ
    // في صفحة الأسعار يقرؤه الزائر عطلًا في الموقع.
    message: 'اكتب السعر، أو علّم الخطة «حسب الطلب».',
    path: ['priceAmount'],
  });

export type PlanUpsertInput = z.infer<typeof planUpsertSchema>;

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type DocumentMetadataInput = z.infer<typeof documentMetadataSchema>;
export type AiSettingsInput = z.infer<typeof aiSettingsSchema>;

/** يحوّل أخطاء Zod إلى رسالة عربية واحدة صالحة للعرض */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'البيانات المُدخلة غير صحيحة.';
}
