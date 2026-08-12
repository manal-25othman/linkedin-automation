import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { askSiteAssistant } from '@/lib/ai/site-chat';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * محادثة زوّار الموقع.
 *
 * مسار عام بلا مصادقة، ولذلك مقيّد بثلاث طبقات: كوكي جلسة عشوائية
 * يُبنى عليها تحديد المعدل، وسقف مطلق لعدد الأسئلة لكل زائر، ومصدر
 * معرفة ثابت في الكود لا يمس قاعدة بيانات الشركات.
 *
 * الكوكي لا يحمل أي بيانات شخصية — قيمة عشوائية للتمييز بين الجلسات
 * ولربط أسئلة الزائر ببعضها داخل المحادثة الواحدة.
 */

const VISITOR_COOKIE = 'ma3rifah_visitor';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function POST(request: NextRequest) {
  let body: { question?: unknown; path?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 });
  }

  if (typeof body.question !== 'string') {
    return NextResponse.json({ error: 'السؤال مطلوب.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const existingKey = cookieStore.get(VISITOR_COOKIE)?.value;
  const visitorKey = existingKey && existingKey.length >= 16 ? existingKey : randomUUID();

  try {
    const result = await askSiteAssistant({
      question: body.question,
      visitorKey,
      entryPath: typeof body.path === 'string' ? body.path : null,
    });

    const response = NextResponse.json(result);

    if (visitorKey !== existingKey) {
      response.cookies.set(VISITOR_COOKIE, visitorKey, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: COOKIE_MAX_AGE_SECONDS,
      });
    }

    return response;
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    // لا تُعرض تفاصيل الخطأ للزائر؛ تبقى في السجلات.
    logger.error('فشل مساعد الزوّار', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'تعذّر الرد الآن. حاول مرة أخرى أو تواصل معنا مباشرة.' },
      { status: 500 },
    );
  }
}
