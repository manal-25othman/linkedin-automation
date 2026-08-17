import 'server-only';

import { NextResponse } from 'next/server';
import { AppError, toAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * هوية الطالب لأغراض تحديد المعدّل.
 *
 * خلف وكيل عكسي يكون REMOTE_ADDR هو الوكيل نفسه، فيُقرأ أول عنوان في
 * X-Forwarded-For. هذا الترويسة قابلة للانتحال في الشبكات المفتوحة، لكن
 * الحدّ هنا يصدّ الإساءة العرضية لا مهاجمًا مصمّمًا — والبديل (بلا حدّ)
 * أسوأ.
 */
export function clientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** يحوّل أي خطأ إلى استجابة JSON صالحة للعرض، ويُسجّل التفصيل التقني */
export function errorResponse(error: unknown, route: string): NextResponse {
  const appError: AppError = toAppError(error);

  if (appError.status >= 500) {
    logger.error('فشل طلب', {
      route,
      code: appError.code,
      detail: appError.detail ?? appError.message,
    });
  } else {
    logger.warn('طلب مرفوض', { route, code: appError.code });
  }

  return NextResponse.json(appError.toJSON(), { status: appError.status });
}

/** يقرأ جسم JSON ويرمي خطأ عرض واضحًا إن كان تالفًا */
export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppError('VALIDATION', 'تعذّر قراءة بيانات الطلب.');
  }
}
