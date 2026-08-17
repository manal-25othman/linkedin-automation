import { NextResponse } from 'next/server';
import * as z from 'zod/v4';
import { rewriteCv } from '@/lib/ai/cv-analyst';
import { cvAnalysisSchema, jobBriefSchema } from '@/lib/ai/schemas';
import { AppError } from '@/lib/errors';
import { clientIdentifier, errorResponse, readJson } from '@/lib/http';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const requestSchema = z.object({
  jobText: z.string(),
  jobBrief: jobBriefSchema,
  cvText: z.string(),
  analysis: cvAnalysisSchema,
  language: z.enum(['auto', 'ar', 'en']),
});

export async function POST(request: Request) {
  try {
    enforceRateLimit(clientIdentifier(request), RATE_LIMITS.analysis);

    const parsed = requestSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'بيانات إعادة الكتابة ناقصة. أعد الخطوات من البداية.');
    }

    const rewrite = await rewriteCv(parsed.data);
    return NextResponse.json({ rewrite });
  } catch (error) {
    return errorResponse(error, 'POST /api/rewrite');
  }
}
