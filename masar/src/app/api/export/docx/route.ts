import { NextResponse } from 'next/server';
import * as z from 'zod/v4';
import { cvFileName, parseCv } from '@/lib/cv-format';
import { buildCvDocx } from '@/lib/docx/build';
import { AppError } from '@/lib/errors';
import { clientIdentifier, errorResponse, readJson } from '@/lib/http';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({ cvText: z.string() });

export async function POST(request: Request) {
  try {
    enforceRateLimit(clientIdentifier(request), RATE_LIMITS.export);

    const parsed = requestSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success || parsed.data.cvText.trim().length < 50) {
      throw new AppError('VALIDATION', 'لا توجد سيرة معدّلة لتصديرها.');
    }

    const buffer = await buildCvDocx(parsed.data.cvText);
    const fileName = cvFileName(parseCv(parsed.data.cvText), 'docx');

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        /*
          اسم الملف قد يكون عربيًا، وترويسة HTTP لاتينية بطبعها. صيغة
          filename* المُرمَّزة بـ UTF-8 هي التي تحفظ الاسم العربي، ويبقى
          filename البسيط بديلًا للعملاء القدامى.
        */
        'Content-Disposition': `attachment; filename="cv.docx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return errorResponse(error, 'POST /api/export/docx');
  }
}
