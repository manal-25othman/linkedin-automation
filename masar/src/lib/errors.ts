/**
 * أخطاء التطبيق.
 *
 * القاعدة: لا تُعرض تفاصيل تقنية ولا مسارات الخادم للمستخدم النهائي.
 * كل خطأ يحمل رسالة عربية صالحة للعرض ورمزًا للتتبّع في السجلات.
 */

export type AppErrorCode =
  | 'VALIDATION'
  | 'RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'JOB_FETCH_FAILED'
  | 'JOB_BLOCKED'
  | 'UNSUPPORTED_FILE'
  | 'FILE_TOO_LARGE'
  | 'EMPTY_DOCUMENT'
  | 'DOCUMENT_PROCESSING'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  VALIDATION: 422,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 503,
  JOB_FETCH_FAILED: 502,
  JOB_BLOCKED: 409,
  UNSUPPORTED_FILE: 415,
  FILE_TOO_LARGE: 413,
  EMPTY_DOCUMENT: 422,
  DOCUMENT_PROCESSING: 500,
  INTERNAL: 500,
};

const DEFAULT_MESSAGE: Record<AppErrorCode, string> = {
  VALIDATION: 'البيانات المُدخلة غير صحيحة.',
  RATE_LIMITED: 'عدد كبير من الطلبات. حاول بعد قليل.',
  AI_UNAVAILABLE: 'خدمة التحليل غير متاحة حاليًا. حاول مرة أخرى.',
  JOB_FETCH_FAILED: 'تعذّر فتح رابط الوظيفة.',
  JOB_BLOCKED:
    'الموقع يمنع قراءة الإعلان آليًا. انسخ نص الوظيفة والصقه في الحقل بالأسفل.',
  UNSUPPORTED_FILE: 'نوع الملف غير مدعوم. المدعوم: PDF و DOCX و TXT.',
  FILE_TOO_LARGE: 'حجم الملف يتجاوز الحد المسموح.',
  EMPTY_DOCUMENT: 'لم يُستخرج أي نص من الملف.',
  DOCUMENT_PROCESSING: 'تعذّر قراءة الملف. حاول بصيغة أخرى.',
  INTERNAL: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** تفصيل داخلي يُسجَّل ولا يُعرض */
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

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return new AppError('INTERNAL', undefined, detail);
}
