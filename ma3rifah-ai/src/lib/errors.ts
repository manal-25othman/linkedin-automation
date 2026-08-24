/**
 * أخطاء التطبيق.
 *
 * القاعدة: لا تُعرض تفاصيل تقنية أو stack traces للمستخدم النهائي.
 * كل خطأ يحمل رسالة عربية صالحة للعرض ورمزًا للتتبّع في السجلات.
 */

import { logger } from '@/lib/logger';

export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'AI_UNAVAILABLE'
  | 'EMBEDDINGS_UNAVAILABLE'
  | 'DOCUMENT_PROCESSING'
  | 'UNSUPPORTED_FILE'
  | 'FILE_TOO_LARGE'
  | 'SCHEMA_OUTDATED'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  SCHEMA_OUTDATED: 503,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 402,
  AI_UNAVAILABLE: 503,
  EMBEDDINGS_UNAVAILABLE: 503,
  DOCUMENT_PROCESSING: 500,
  UNSUPPORTED_FILE: 415,
  FILE_TOO_LARGE: 413,
  INTERNAL: 500,
};

const DEFAULT_MESSAGE: Record<AppErrorCode, string> = {
  UNAUTHENTICATED: 'يلزم تسجيل الدخول للمتابعة.',
  FORBIDDEN: 'ليست لديك صلاحية للوصول إلى هذا المورد.',
  NOT_FOUND: 'العنصر المطلوب غير موجود.',
  VALIDATION: 'البيانات المُدخلة غير صحيحة.',
  RATE_LIMITED: 'عدد كبير من الطلبات. يُرجى المحاولة بعد قليل.',
  QUOTA_EXCEEDED: 'تم استهلاك الحد الشهري لخطة الاشتراك.',
  AI_UNAVAILABLE: 'خدمة المساعد الذكي غير متاحة حاليًا. حاول مرة أخرى.',
  EMBEDDINGS_UNAVAILABLE: 'خدمة تحليل النصوص غير متاحة حاليًا.',
  DOCUMENT_PROCESSING: 'تعذّر معالجة المستند. حاول مرة أخرى.',
  UNSUPPORTED_FILE: 'نوع الملف غير مدعوم.',
  FILE_TOO_LARGE: 'حجم الملف يتجاوز الحد المسموح.',
  SCHEMA_OUTDATED:
    'قاعدة البيانات لم تُحدَّث بعد. شغّلي ملف supabase/ALL_MIGRATIONS.sql في محرّر SQL على Supabase ثم أعيدي المحاولة.',
  INTERNAL: 'حدث خطأ غير متوقع. تم تسجيل المشكلة وسنعمل على معالجتها.',
};

/**
 * الأخطاء التي يستحق المستخدمُ فيها رقمَ مرجع.
 *
 * الرقم لمن **لا يستطيع إصلاح الخطأ بنفسه**: عطلٌ عندنا يحتاج أن
 * يخبرنا به. أما «أدخل بريدًا صحيحًا · ERR-8F31» فضجيج — يُشعِر
 * المستخدم بأن خطأه المطبعيّ عطلٌ في المنصة، ويُغرِق الدعم بأرقام لا
 * شيء خلفها.
 */
const REFERENCED_CODES: ReadonlySet<AppErrorCode> = new Set<AppErrorCode>([
  'INTERNAL',
  'DOCUMENT_PROCESSING',
  'AI_UNAVAILABLE',
  'EMBEDDINGS_UNAVAILABLE',
]);

export function needsReference(code: AppErrorCode): boolean {
  return REFERENCED_CODES.has(code);
}

/**
 * رقم مرجع قصير.
 *
 * أربعة محارف من السداسي العشري: قصير بما يُقرأ في الهاتف ويُكتب في
 * تذكرة، وواسع بما يكفي (65536 احتمالًا) لأن يميّز أخطاء الدقيقة
 * الواحدة. وليس معرّفًا فريدًا عالميًا — ولا يُراد له ذلك: البحث في
 * السجلّات يقع في نافذة زمنية معلومة، فالتصادم بعد شهر لا يضرّ.
 *
 * ولا يحمل معلومة: لا وقتًا ولا هوية ولا نوع خطأ. من التقطه من شاشة
 * لا يستفيد منه شيئًا، ومن عنده السجلّ يجده.
 */
export function newErrorReference(): string {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  return `ERR-${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** تفاصيل داخلية تُسجَّل ولا تُعرض للمستخدم */
  readonly detail?: string;
  /** رقم مرجع — يوجد على الأخطاء التي لا يصلحها المستخدم بنفسه */
  readonly reference?: string;

  constructor(code: AppErrorCode, message?: string, detail?: string) {
    super(message ?? DEFAULT_MESSAGE[code]);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.detail = detail;
    this.reference = needsReference(code) ? newErrorReference() : undefined;
  }

  /** الرسالة كما تُعرض — ومعها المرجع إن وُجد */
  get displayMessage(): string {
    return this.reference ? `${this.message}\nرقم المرجع: ${this.reference}` : this.message;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.reference ? { reference: this.reference } : {}),
      },
    };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * يحوّل أي خطأ إلى AppError صالح للعرض.
 *
 * ويُسجَّل التفصيل التقني هنا مقرونًا برقم المرجع — وهذا هو موضع
 * التسجيل الصحيح: كل خطأ غير متوقع يمرّ من هنا، فلا يضيع واحد لأن
 * مستدعيًا نسي أن يسجّله. والمستخدم يرى الرقم، والمطوّر يجده بالبحث
 * عنه في السجلّ ومعه سبب الخطأ الحقيقي.
 */
/**
 * أخطاء «القاعدة لم تُحدَّث».
 *
 *   42P01 — جدول غير موجود
 *   42883 — دالّة غير موجودة
 *   42703 — عمود غير موجود
 *
 * وهي أكثر ما يُرى بعد نشرٍ لم تُشغَّل ترحيلاته: الشيفرة الجديدة تنادي
 * جدولًا لم يُنشأ بعد. ورسالة «حدث خطأ غير متوقع» هنا تُضيّع ساعة على
 * من يبحث عن عطل في الشيفرة، والعطل ليس فيها — إنما في خطوةٍ لم تُنفَّذ.
 *
 * والقاعدة العامة تبقى: لا تُعرض تفاصيل تقنية للمستخدم. وهذا استثناء
 * مقصود ومحصور، لأن المتلقّي هنا هو مالكة المنصّة نفسها، والرسالة
 * تُخبرها بما تفعله لا بما انكسر.
 */
const SCHEMA_ERROR_CODES = new Set(['42P01', '42883', '42703']);

function isSchemaOutdated(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && SCHEMA_ERROR_CODES.has(code)) return true;

  const message = (error as { message?: unknown }).message;
  return (
    typeof message === 'string' &&
    /does not exist|schema cache/i.test(message) &&
    /relation|function|column/i.test(message)
  );
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (isSchemaOutdated(error)) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error('القاعدة لم تُحدَّث — ترحيلة لم تُشغَّل', {
      detail: sanitizeTechnicalDetail(detail),
    });
    return new AppError(
      'SCHEMA_OUTDATED',
      'قاعدة البيانات لم تُحدَّث بعد. شغّلي ملف supabase/ALL_MIGRATIONS.sql في محرّر SQL على Supabase ثم أعيدي المحاولة.',
    );
  }

  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const wrapped = new AppError('INTERNAL', undefined, detail);

  logger.error('خطأ غير متوقع', {
    reference: wrapped.reference,
    detail: sanitizeTechnicalDetail(detail),
  });

  return wrapped;
}

/**
 * تنقيح تفصيل تقني ليُعرض للمستخدم.
 *
 * يُحذف الدليل ويبقى اسم الملف: بنية الخادم لا تخصّ أحدًا، أما الاسم
 * فهو غالبًا كل التشخيص. محو المسار كاملًا حوّل مرة خطأً واضحًا
 * («تعذّر إيجاد pdf.worker.mjs») إلى نقاط لا تدلّ على شيء.
 */
export function sanitizeTechnicalDetail(detail: string): string {
  return detail
    .split('\n')[0]
    .replace(/https?:\/\/\S+/g, '…') // روابط
    .replace(/(?:\/[\w.@ -]+)+\/([\w.@-]+)/g, '$1') // مسارات نظام الملفات
    .trim()
    .slice(0, 180);
}
