'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordAudit } from '@/lib/audit';
import { AppError, toAppError } from '@/lib/errors';
import { planUpsertSchema, firstIssueMessage } from '@/lib/validation/schemas';
import { SITE_TEXT, defaultSiteText } from '@/content/site-text';
import type { SitePageStatus } from '@/types/database';

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export async function setCompanyStatusAction(
  companyId: string,
  status: 'ACTIVE' | 'SUSPENDED',
): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();
    const admin = createAdminClient();

    const { error } = await admin.from('companies').update({ status }).eq('id', companyId);
    if (error) throw error;

    await recordAudit({
      companyId,
      actorId: session.profile.id,
      actorEmail: session.profile.email,
      action: 'company.updated',
      entityType: 'company',
      entityId: companyId,
      metadata: { status },
    });

    revalidatePath('/admin/companies');
    revalidatePath('/admin');

    return {
      ok: true,
      message: status === 'ACTIVE' ? 'تم تفعيل الشركة.' : 'تم إيقاف الشركة.',
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/**
 * حفظ خطة — إنشاءً أو تعديلًا.
 *
 * محصور بمالك المنصة: الأسعار والحدود التي تُكتب هنا هي التي يراها كل
 * زائر على صفحة الأسعار، وهي التي تُقاس عليها حدود كل شركة مشتركة.
 *
 * وتُبطَل ذاكرة صفحتَي الأسعار والرئيسية بعد الحفظ، وإلا بقي السعر
 * القديم معروضًا للزوّار بعد تغييره — وهو أسوأ من عدم التغيير أصلًا،
 * لأن البائع يظن أنه غيّر والمشتري يرى غير ذلك.
 */
export async function upsertPlanAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();

    const parsed = planUpsertSchema.safeParse({
      planId: formData.get('planId') || null,
      code: formData.get('code'),
      name: formData.get('name'),
      description: formData.get('description') ?? '',
      priceAmount: formData.get('priceAmount') ?? '',
      currency: formData.get('currency') || 'SAR',
      maxUsers: formData.get('maxUsers') ?? '',
      maxDocuments: formData.get('maxDocuments') ?? '',
      maxQuestionsMonthly: formData.get('maxQuestionsMonthly') ?? '',
      maxStorageMb: formData.get('maxStorageMb') ?? '',
      features: formData.get('features') ?? '',
      isPublic: formData.get('isPublic') === 'on',
      isCustomPriced: formData.get('isCustomPriced') === 'on',
      sortOrder: formData.get('sortOrder') || 0,
    });

    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const input = parsed.data;
    const admin = createAdminClient();

    const row = {
      code: input.code,
      name: input.name,
      description: input.description || null,
      // الخطة «حسب الطلب» لا سعر لها — لو بقي رقم قديم لعُرض الاثنان معًا
      price_amount: input.isCustomPriced ? null : input.priceAmount,
      currency: input.currency,
      max_users: input.maxUsers,
      max_documents: input.maxDocuments,
      max_questions_monthly: input.maxQuestionsMonthly,
      max_storage_mb: input.maxStorageMb,
      features: input.features
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
      is_public: input.isPublic,
      is_custom_priced: input.isCustomPriced,
      sort_order: input.sortOrder,
    };

    const { error } = input.planId
      ? await admin.from('plans').update(row).eq('id', input.planId)
      : await admin.from('plans').insert(row);

    if (error) {
      // الرمز مفتاح فريد، وتصادمه أشيع خطأ هنا
      if (error.code === '23505') {
        throw new AppError('VALIDATION', 'يوجد خطة بهذا الرمز مسبقًا. اختر رمزًا آخر.');
      }
      throw error;
    }

    await recordAudit({
      companyId: null,
      actorId: session.profile.id,
      actorEmail: session.profile.email,
      action: input.planId ? 'plan.updated' : 'plan.created',
      entityType: 'plan',
      entityId: input.planId ?? null,
      metadata: { code: input.code, isPublic: input.isPublic },
    });

    revalidatePath('/admin/plans');
    revalidatePath('/pricing');
    revalidatePath('/');

    return { ok: true, message: input.planId ? 'تم حفظ الخطة.' : 'تمت إضافة الخطة.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/**
 * إخفاء خطة أو إظهارها.
 *
 * لا حذف: الخطة المحذوفة تكسر اشتراكات قائمة تشير إليها. الإخفاء يمنعها
 * من صفحة الأسعار ويُبقي من اشترك بها على ما اتفق عليه.
 */
export async function setPlanVisibilityAction(
  planId: string,
  isPublic: boolean,
): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();
    const admin = createAdminClient();

    const { error } = await admin.from('plans').update({ is_public: isPublic }).eq('id', planId);
    if (error) throw error;

    await recordAudit({
      companyId: null,
      actorId: session.profile.id,
      actorEmail: session.profile.email,
      action: 'plan.updated',
      entityType: 'plan',
      entityId: planId,
      metadata: { isPublic },
    });

    revalidatePath('/admin/plans');
    revalidatePath('/pricing');
    revalidatePath('/');

    return { ok: true, message: isPublic ? 'صارت الخطة معروضة.' : 'أُخفيت الخطة.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/**
 * حفظ نصوص الموقع.
 *
 * تُحفظ التجاوزات وحدها: نصّ يطابق الأصلي يُحذف صفّه بدل أن يُخزَّن،
 * فيبقى الجدول صغيرًا ويظلّ «العودة إلى الأصل» عمليةً واحدة لا اثنتين.
 *
 * وتُبطَل ذاكرة الصفحات بعد الحفظ، وإلا رأت المحرِّرة تغييرها في المحرِّر
 * ولم تره على الموقع — فتظن أن الحفظ لم يعمل وتعيده مرارًا.
 */
export async function saveSiteTextAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();
    const admin = createAdminClient();

    const toUpsert: { key: string; value: string; updated_by: string }[] = [];
    const toReset: string[] = [];

    const defaults = defaultSiteText();

    for (const [key, entry] of Object.entries(SITE_TEXT)) {
      const raw = formData.get(`text:${key}`);
      if (raw === null) continue;

      const value = String(raw).replace(/\r\n/g, '\n').trim();

      // الحدّ هنا يطابق قيد قاعدة البيانات (0023). والقائمة تُخزَّن مُسلسَلة
      // في صفّ واحد، فحدُّ النصّ المفرد لا يصلح لها: قائمة الأسئلة وحدها
      // تتجاوز خمسة آلاف محرف بأجوبتها.
      const limit = entry.kind === 'list' ? 200_000 : 5_000;
      if (value.length > limit) {
        throw new AppError('VALIDATION', `المحتوى «${entry.label}» أطول من الحد المسموح.`);
      }

      // القائمة تصل مُسلسَلة — تُتحقَّق قبل الحفظ كي لا يُخزَّن نصّ تالف
      // يكسر الصفحة لاحقًا. الفشل هنا مرئي، وهناك صامت.
      if (entry.kind === 'list' && value !== '') {
        try {
          const parsed: unknown = JSON.parse(value);
          if (!Array.isArray(parsed)) throw new Error('not an array');
        } catch {
          throw new AppError('VALIDATION', `تعذّر حفظ «${entry.label}» — بنية غير صالحة.`);
        }
      }

      // الفراغ يعني «أعِد الأصلي» لا «اجعله فارغًا»: نصّ فارغ في صفحة
      // عامة عطبٌ ظاهر، والمحرِّرة تمسح الحقل عادةً وهي تقصد التراجع.
      if (value === '' || value === (defaults[key] ?? '').trim()) {
        toReset.push(key);
      } else {
        toUpsert.push({ key, value, updated_by: session.profile.id });
      }
    }

    if (toUpsert.length > 0) {
      const { error } = await admin.from('site_content').upsert(toUpsert, { onConflict: 'key' });
      if (error) throw error;
    }

    if (toReset.length > 0) {
      const { error } = await admin.from('site_content').delete().in('key', toReset);
      if (error) throw error;
    }

    await recordAudit({
      companyId: null,
      actorId: session.profile.id,
      actorEmail: session.profile.email,
      action: 'site_content.updated',
      entityType: 'site_content',
      metadata: { changed: toUpsert.length, reset: toReset.length },
    });

    // كل صفحة قد تحمل نصًّا محرَّرًا
    revalidatePath('/', 'layout');

    return {
      ok: true,
      message:
        toUpsert.length === 0
          ? 'أُعيدت كل النصوص إلى صيغتها الأصلية.'
          : `حُفظ ${toUpsert.length} نصًّا. افتحي الموقع لترَي التغيير.`,
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

// =====================================================================
// صفحات يصنعها مالك المنصة
// =====================================================================

/**
 * الأسماء المحجوزة.
 *
 * البادئة `/p/` تمنع حجب مسارات التطبيق أصلًا، لكن هذه أسماء تُنشئ
 * لبسًا حتى تحتها: صفحة اسمها `login` تحت `/p/login` تبدو صفحة دخول
 * ثانية، ومن يصلها من رابط منسوخ لا يدري لماذا لا تطلب كلمة سرّ.
 */
const RESERVED_SLUGS = new Set([
  'login',
  'register',
  'dashboard',
  'admin',
  'api',
  'auth',
  'p',
]);

const SLUG_FORBIDDEN = /[\s/?#%&.]/;

function readPageForm(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const body = String(formData.get('body') ?? '').replace(/\r\n/g, '\n').trim();
  const showInNav = formData.get('showInNav') === 'on';
  const publish = formData.get('status') === 'PUBLISHED';
  const sortOrder = Number(formData.get('sortOrder') ?? 0);

  if (title === '') throw new AppError('VALIDATION', 'عنوان الصفحة مطلوب.');
  if (title.length > 200) throw new AppError('VALIDATION', 'العنوان أطول من الحد المسموح.');
  if (slug.length < 2 || slug.length > 60) {
    throw new AppError('VALIDATION', 'اسم الرابط يجب أن يكون بين حرفين و٦٠ حرفًا.');
  }
  if (SLUG_FORBIDDEN.test(slug)) {
    throw new AppError(
      'VALIDATION',
      'اسم الرابط لا يقبل مسافة ولا الرموز . / ? # % & — استعملي شَرطة بدلها.',
    );
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new AppError('VALIDATION', `الاسم «${slug}» محجوز — اختاري غيره.`);
  }
  if (description.length > 500) {
    throw new AppError('VALIDATION', 'الوصف أطول من الحد المسموح.');
  }
  if (body.length > 200_000) {
    throw new AppError('VALIDATION', 'محتوى الصفحة أطول من الحد المسموح.');
  }
  if (!Number.isFinite(sortOrder) || sortOrder < 0 || sortOrder > 999) {
    throw new AppError('VALIDATION', 'ترتيب الصفحة رقم بين ٠ و٩٩٩.');
  }

  return {
    slug,
    title,
    description: description === '' ? null : description,
    body,
    show_in_nav: showInNav,
    status: (publish ? 'PUBLISHED' : 'DRAFT') as SitePageStatus,
    sort_order: Math.trunc(sortOrder),
  };
}

/** خطأ تفرّد الاسم يصل من قاعدة البيانات برمز 23505 — يُترجم لا يُعرض */
function toReadableSaveError(error: unknown): never {
  const code = (error as { code?: string } | null)?.code;
  if (code === '23505') {
    throw new AppError('VALIDATION', 'يوجد صفحة بهذا الاسم — اختاري اسمًا آخر.');
  }
  throw error;
}

function revalidateSitePages(slug: string) {
  revalidatePath('/admin/pages');
  revalidatePath('/', 'layout');
  revalidatePath(`/p/${slug}`);
}

export async function createSitePageAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();
    const values = readPageForm(formData);
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('site_pages')
      .insert({ ...values, updated_by: session.profile.id })
      .select('id')
      .single();

    if (error) toReadableSaveError(error);

    await recordAudit({
      companyId: null,
      actorId: session.profile.id,
      actorEmail: session.profile.email,
      action: 'site_page.created',
      entityType: 'site_page',
      entityId: data?.id ?? null,
      metadata: { slug: values.slug, status: values.status },
    });

    revalidateSitePages(values.slug);

    return {
      ok: true,
      message:
        values.status === 'PUBLISHED'
          ? `نُشرت الصفحة على /p/${values.slug}`
          : 'حُفظت الصفحة مسوّدة — لا يراها الزوّار حتى تنشريها.',
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

export async function updateSitePageAction(
  pageId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();
    const values = readPageForm(formData);
    const admin = createAdminClient();

    const { error } = await admin
      .from('site_pages')
      .update({ ...values, updated_by: session.profile.id })
      .eq('id', pageId);

    if (error) toReadableSaveError(error);

    await recordAudit({
      companyId: null,
      actorId: session.profile.id,
      actorEmail: session.profile.email,
      action: 'site_page.updated',
      entityType: 'site_page',
      entityId: pageId,
      metadata: { slug: values.slug, status: values.status },
    });

    revalidateSitePages(values.slug);

    return { ok: true, message: 'حُفظت الصفحة.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

export async function setSitePageStatusAction(
  pageId: string,
  status: 'DRAFT' | 'PUBLISHED',
): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('site_pages')
      .update({ status, updated_by: session.profile.id })
      .eq('id', pageId)
      .select('slug')
      .single();

    if (error) throw error;

    await recordAudit({
      companyId: null,
      actorId: session.profile.id,
      actorEmail: session.profile.email,
      action: 'site_page.updated',
      entityType: 'site_page',
      entityId: pageId,
      metadata: { status },
    });

    revalidateSitePages(data?.slug ?? '');

    return {
      ok: true,
      message: status === 'PUBLISHED' ? 'نُشرت الصفحة.' : 'أُعيدت الصفحة مسوّدة.',
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

export async function deleteSitePageAction(pageId: string): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();
    const admin = createAdminClient();

    // يُقرأ الاسم قبل الحذف: بعده لا سبيل إلى إبطال ذاكرة مساره
    const { data: existing } = await admin
      .from('site_pages')
      .select('slug')
      .eq('id', pageId)
      .maybeSingle();

    const { error } = await admin.from('site_pages').delete().eq('id', pageId);
    if (error) throw error;

    await recordAudit({
      companyId: null,
      actorId: session.profile.id,
      actorEmail: session.profile.email,
      action: 'site_page.deleted',
      entityType: 'site_page',
      entityId: pageId,
      metadata: { slug: existing?.slug ?? null },
    });

    revalidateSitePages(existing?.slug ?? '');

    return { ok: true, message: 'حُذفت الصفحة.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/**
 * المصاريف الثابتة للمنصّة.
 *
 * تُدخَل يدويًا لأنها ليست في أي جدول: فاتورة الاستضافة والقاعدة
 * والأدوات لا تمرّ بالمنتج. وبلا إدخالها لا يُطرح منها شيء، فيظهر
 * الربح أكبر مما هو — وعلى رقمٍ كهذا تُتخذ قرارات توظيف وإنفاق.
 */
export async function addPlatformExpenseAction(
  input: { label: string; amountUsd: number; startsOn: string; note?: string },
): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();

    const label = input.label.trim();
    if (label.length < 2 || label.length > 80) {
      throw new AppError('VALIDATION', 'اسم المصروف بين حرفين وثمانين حرفًا.');
    }
    if (!Number.isFinite(input.amountUsd) || input.amountUsd < 0) {
      throw new AppError('VALIDATION', 'المبلغ يجب أن يكون رقمًا موجبًا.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn)) {
      throw new AppError('VALIDATION', 'تاريخ البداية غير صالح.');
    }

    const admin = createAdminClient();
    const { error } = await admin.from('platform_expenses').insert({
      label,
      amount_usd: input.amountUsd,
      starts_on: input.startsOn,
      note: input.note?.trim() || null,
    });
    if (error) throw error;

    await recordAudit({
      companyId: null,
      actorId: session.profile.id,
      actorEmail: session.profile.email,
      action: 'platform.expense.added',
      entityType: 'platform_expense',
      entityId: null,
      metadata: { label, amountUsd: input.amountUsd },
    });

    revalidatePath('/admin/finance');
    return { ok: true, message: 'أُضيف المصروف.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/**
 * إنهاء مصروف بدل حذفه.
 *
 * الحذف يزوّر الماضي: المصروف الذي دُفع فعلًا في الأشهر السابقة يختفي
 * منها، فيرتفع ربحُ شهرٍ مضى بأثر رجعي. والإنهاء يوقفه من تاريخه
 * ويُبقي التاريخ كما كان.
 */
export async function endPlatformExpenseAction(
  expenseId: string,
  endsOn: string,
): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
      throw new AppError('VALIDATION', 'تاريخ الانتهاء غير صالح.');
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('platform_expenses')
      .update({ ends_on: endsOn })
      .eq('id', expenseId);
    if (error) throw error;

    await recordAudit({
      companyId: null,
      actorId: session.profile.id,
      actorEmail: session.profile.email,
      action: 'platform.expense.ended',
      entityType: 'platform_expense',
      entityId: expenseId,
      metadata: { endsOn },
    });

    revalidatePath('/admin/finance');
    return { ok: true, message: 'أُنهي المصروف.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

// =====================================================================
// رموز الدعوة
// =====================================================================

/** حروف بلا التباس بصري: لا 0/O ولا 1/I/L */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * نقل الحروف العربية إلى ما يقابلها لاتينيًا — للبادئة وحدها.
 *
 * البادئة كانت تُؤخذ من الاسم كما هو، فيُنتج «شركة خبراء الأعمال» رمزًا
 * مختلط الاتجاه: `شركة-AKF4WZ`. وهو صحيح في القاعدة ومعطوب في الاستعمال
 * — يُنسخ في رسالة فينقلب ترتيبه، ويُملى على الهاتف فيُخطئ، ويُكتب في
 * حقل `dir="ltr"` فيقفز المؤشّر.
 *
 * والنقل يبقي البادئة دالّة على صاحبها — وهي فائدتها كلّها — بلا أن
 * تكسر الاتجاه.
 */
const ARABIC_TO_LATIN: Record<string, string> = {
  ا: 'A', أ: 'A', إ: 'A', آ: 'A', ب: 'B', ت: 'T', ث: 'TH', ج: 'J',
  ح: 'H', خ: 'KH', د: 'D', ذ: 'Z', ر: 'R', ز: 'Z', س: 'S', ش: 'SH',
  ص: 'S', ض: 'D', ط: 'T', ظ: 'Z', ع: 'A', غ: 'G', ف: 'F', ق: 'Q',
  ك: 'K', ل: 'L', م: 'M', ن: 'N', ه: 'H', ة: 'H', و: 'W', ي: 'Y',
  ى: 'Y', ئ: 'Y', ء: 'A', ؤ: 'W',
};

function generateCode(label: string): string {
  // بادئة من اسم الشركة تجعل الرمز مقروءًا في رسالة، فيُعرف لمن أُرسل
  const latin = [...label]
    .map((char) => ARABIC_TO_LATIN[char] ?? (/[A-Za-z]/.test(char) ? char : ''))
    .join('');

  const prefix = latin.slice(0, 4).toUpperCase() || 'MA3';

  const random = Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length],
  ).join('');

  return `${prefix}-${random}`;
}

export async function createInviteCodeAction(input: {
  label: string;
  maxUses: number;
  expiresInDays: number;
  note?: string;
}): Promise<ActionResult & { code?: string }> {
  try {
    const session = await requireSuperAdmin();

    const label = input.label.trim();
    if (label.length < 2 || label.length > 120) {
      throw new AppError('VALIDATION', 'اسم الجهة بين حرفين ومئة وعشرين حرفًا.');
    }
    if (!Number.isInteger(input.maxUses) || input.maxUses < 1 || input.maxUses > 500) {
      throw new AppError('VALIDATION', 'عدد الاستعمالات بين ١ و٥٠٠.');
    }
    if (!Number.isInteger(input.expiresInDays) || input.expiresInDays < 1) {
      throw new AppError('VALIDATION', 'مدة الصلاحية يوم واحد على الأقل.');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

    const admin = createAdminClient();
    const code = generateCode(label);

    const { error } = await admin.from('invite_codes').insert({
      code,
      label,
      max_uses: input.maxUses,
      expires_at: expiresAt.toISOString(),
      note: input.note?.trim() || null,
      created_by: session.profile.id,
    });
    if (error) throw error;

    // الرمز نفسه لا يدخل سجلّ التدقيق: السجلّ يُقرأ ويُصدَّر، والرمز مفتاح
    await recordAudit({
      companyId: null,
      actorId: session.profile.id,
      actorEmail: session.profile.email,
      action: 'invite.created',
      entityType: 'invite_code',
      entityId: null,
      metadata: { label, maxUses: input.maxUses },
    });

    revalidatePath('/admin/invites');
    return { ok: true, message: 'أُنشئ الرمز.', code };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/**
 * إلغاء رمز — ولا يُحذف.
 *
 * الحذف يمحو من استُعمل الرمز لأجله، فيضيع أثر الحسابات التي أُنشئت به.
 * والإلغاء يوقفه فورًا ويُبقي السجلّ.
 */
export async function revokeInviteCodeAction(inviteId: string): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();
    const admin = createAdminClient();

    const { error } = await admin
      .from('invite_codes')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId);
    if (error) throw error;

    await recordAudit({
      companyId: null,
      actorId: session.profile.id,
      actorEmail: session.profile.email,
      action: 'invite.revoked',
      entityType: 'invite_code',
      entityId: inviteId,
    });

    revalidatePath('/admin/invites');
    return { ok: true, message: 'أُلغي الرمز.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}
