import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import { clientIdentifier, errorResponse } from '@/lib/http';
import {
  extractDocumentText,
  MAX_FILE_SIZE_BYTES,
  SUPPORTED_EXTENSIONS,
} from '@/lib/cv/extract';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * استخراج نصّ السيرة.
 *
 * الملف لا يُحفظ في أي مكان: يُقرأ في الذاكرة، يُستخرج نصّه، ويُعاد النص
 * إلى المتصفح. المستودع بلا قاعدة بيانات ولا تخزين عن قصد — السيرة الذاتية
 * أثقل بيانات المستخدم، وأسلم سياسة احتفاظ هي ألّا نحتفظ.
 */
export async function POST(request: Request) {
  try {
    enforceRateLimit(clientIdentifier(request), RATE_LIMITS.upload);

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');

    if (!(file instanceof File)) {
      throw new AppError('VALIDATION', 'لم يُرفع أي ملف.');
    }

    if (file.size === 0) {
      throw new AppError('VALIDATION', 'الملف فارغ.');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new AppError(
        'FILE_TOO_LARGE',
        `حجم الملف يتجاوز ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))} ميجابايت.`,
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await extractDocumentText(buffer, file.name, file.type);

    return NextResponse.json({
      fileName: file.name,
      pageCount: result.pageCount,
      text: result.text,
      supported: SUPPORTED_EXTENSIONS,
    });
  } catch (error) {
    return errorResponse(error, 'POST /api/cv');
  }
}
