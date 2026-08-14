import { NextResponse, type NextRequest } from 'next/server';
import {
  getWhatsAppConfig,
  verifySignature,
  sendWhatsAppText,
} from '@/lib/whatsapp/client';
import { extractMessages, handleIncomingMessage } from '@/lib/whatsapp/handler';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * ويب هوك واتساب.
 *
 * المدخل الوحيد الذي يبدأه غيرنا، فيُعامل معاملة المصدر غير الموثوق:
 *  ١) لا يُقرأ الجسم إلا بعد التحقق من توقيع Meta.
 *  ٢) الهوية تُشتق من ربط هاتف موثّق في قاعدة البيانات، ولا تُقبل من
 *     نص الرسالة مهما ادّعى.
 *  ٣) يُردّ 200 دائمًا بعد التحقق — أي رمز آخر يجعل Meta تعيد الإرسال
 *     مرارًا، فيتلقّى المستخدم الإجابة نفسها عدة مرات ويُستنزف الرصيد.
 */

/** تحقق الاشتراك — تستدعيه Meta مرة عند ضبط الويب هوك */
export async function GET(request: NextRequest) {
  const config = getWhatsAppConfig();
  if (!config) return new NextResponse('غير مُهيّأ', { status: 503 });

  const params = request.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode === 'subscribe' && token === config.verifyToken && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new NextResponse('مرفوض', { status: 403 });
}

export async function POST(request: NextRequest) {
  const config = getWhatsAppConfig();
  if (!config) return new NextResponse('غير مُهيّأ', { status: 503 });

  // يُقرأ الجسم نصًا خامًا: التوقيع محسوب على البايتات كما أُرسلت،
  // وإعادة ترميز JSON تغيّرها فيفشل التحقق على حمولات صحيحة.
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifySignature(rawBody, signature, config.appSecret)) {
    logger.warn('توقيع واتساب غير صالح — رُفض الطلب');
    return new NextResponse('توقيع غير صالح', { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const messages = extractMessages(payload);

  // تُعالَج بالتسلسل: التوازي على قناة واحدة يخلط ترتيب الردود، ويضاعف
  // الضغط على مزوّد التضمينات بلا مكسب يُذكر عند هذا الحجم.
  for (const message of messages) {
    try {
      const reply = await handleIncomingMessage(message);
      await sendWhatsAppText(message.from, reply);
    } catch (error) {
      logger.error('فشل معالجة رسالة واتساب', {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ ok: true });
}
