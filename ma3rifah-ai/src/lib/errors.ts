/**
 * أخطاء التطبيق.
 *
 * القاعدة: لا تُعرض تفاصيل تقنية أو stack traces للمستخدم النهائي.
 * كل خطأ يحمل رسالة عربية صالحة للعرض ورمزًا للتتبّع في السجلات.
 */

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
  | 'INTERNAL';

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
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
  INTERNAL: 'حدث خطأ غير متوقع. تم تسجيل المشكلة وسنعمل على معالجتها.',
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** تفاصيل داخلية تُسجَّل ولا تُعرض للمستخدم */
  readonly detail?: string;

  constructor(code: AppErrorCode, message?: string, detail?: string) {
    super(message ?? DEFAULT_MESSAGE[code]);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.detail = detail;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message } };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** يحوّل أي خطأ إلى AppError صالح للعرض */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return new AppError('INTERNAL', undefined, detail);
}
