import { NextResponse } from 'next/server';
import * as z from 'zod/v4';
import { buildJobBrief } from '@/lib/ai/job-advisor';
import { AppError } from '@/lib/errors';
import { clientIdentifier, errorResponse, readJson } from '@/lib/http';
import { fetchJobPosting } from '@/lib/job/fetch';
import { trimJobText } from '@/lib/job/html';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const requestSchema = z
  .object({
    url: z.string().optional(),
    text: z.string().optional(),
  })
  .refine((value) => Boolean(value.url?.trim() || value.text?.trim()), {
    message: 'أدخل رابط الوظيفة أو الصق نصّها.',
  });

/** أقصر نصّ يُعدّ إعلان وظيفة — ما دونه سطر ملصوق بالخطأ */
const MIN_JOB_TEXT = 120;

export async function POST(request: Request) {
  try {
    enforceRateLimit(clientIdentifier(request), RATE_LIMITS.analysis);

    const body = await readJson<unknown>(request);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION', parsed.error.issues[0]?.message ?? undefined);
    }

    const pastedText = parsed.data.text?.trim();
    const url = parsed.data.url?.trim();

    // النص الملصوق يتقدّم على الرابط: المستخدم لجأ إليه غالبًا بعد أن
    // منع الموقعُ القراءةَ الآلية، فإعادة المحاولة على الرابط تفشل ثانيةً.
    let posting: { text: string; source: string; url?: string; title?: string; company?: string; location?: string };

    if (pastedText) {
      if (pastedText.length < MIN_JOB_TEXT) {
        throw new AppError('VALIDATION', 'نص الوظيفة قصير جدًا. الصق الإعلان كاملًا.');
      }
      posting = { text: trimJobText(pastedText), source: 'manual', url };
    } else {
      const fetched = await fetchJobPosting(url!);
      enforceRateLimit(clientIdentifier(request), RATE_LIMITS.jobFetch);
      posting = {
        text: fetched.text,
        source: fetched.source,
        url: fetched.url,
        title: fetched.title,
        company: fetched.company,
        location: fetched.location,
      };
    }

    const brief = await buildJobBrief({ jobText: posting.text, sourceUrl: posting.url });

    return NextResponse.json({ posting, brief });
  } catch (error) {
    return errorResponse(error, 'POST /api/job');
  }
}
