import { NextResponse } from 'next/server';
import * as z from 'zod/v4';
import { analyzeCv } from '@/lib/ai/cv-analyst';
import { jobBriefSchema } from '@/lib/ai/schemas';
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
});

export async function POST(request: Request) {
  try {
    enforceRateLimit(clientIdentifier(request), RATE_LIMITS.analysis);

    const parsed = requestSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'بيانات التحليل ناقصة. أعد الخطوات من البداية.');
    }

    if (parsed.data.cvText.trim().length < 100) {
      throw new AppError('VALIDATION', 'نص السيرة قصير جدًا للتحليل.');
    }

    const analysis = await analyzeCv(parsed.data);
    return NextResponse.json({ analysis });
  } catch (error) {
    return errorResponse(error, 'POST /api/analyze');
  }
}
