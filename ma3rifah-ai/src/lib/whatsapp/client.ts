import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { logger } from '@/lib/logger';

/**
 * عميل واجهة واتساب للأعمال (Meta Cloud API).
 *
 * القناة الخارجية الوحيدة التي **يبدأ منها غيرنا** الطلب: بقية النظام
 * يستقبل طلبات من متصفح يحمل جلسة، أما هنا فيصل الطلب من خادم Meta —
 * أو ممّن يدّعي أنه Meta. لذلك التحقق من التوقيع شرط أول لا تفصيلة:
 * بلا توقيع صحيح، يستطيع أي أحد أن يرسل «رسالة من رقم فلان» فيقرأ
 * معرفة شركته.
 */

const GRAPH_VERSION = 'v21.0';

export interface WhatsAppConfig {
  token: string;
  phoneNumberId: string;
  verifyToken: string;
  appSecret: string;
}

/** الإعدادات مقروءة وقت الطلب لا وقت البناء — القناة اختيارية */
export function getWhatsAppConfig(): WhatsAppConfig | null {
  const token = process.env.WHATSAPP_TOKEN ?? '';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? '';
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? '';

  if (!token || !phoneNumberId || !verifyToken || !appSecret) return null;
  return { token, phoneNumberId, verifyToken, appSecret };
}

export function isWhatsAppConfigured(): boolean {
  return getWhatsAppConfig() !== null;
}

/**
 * التحقق من توقيع Meta للطلب.
 *
 * يُقارَن بـtimingSafeEqual لا بـ=== : المقارنة النصية تخرج عند أول
 * محرف مختلف، ففرق الزمن يسرّب التوقيع الصحيح محرفًا محرفًا لمن يقيس.
 */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith('sha256=')) return false;

  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const received = header.slice('sha256='.length);

  if (received.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

/** تطبيع رقم الهاتف إلى أرقام فقط (E.164 بلا +) */
export function normalizePhone(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

/**
 * إرسال رسالة نصية.
 *
 * لا يرمي عند الفشل: الويب هوك يجب أن يردّ 200 لـMeta مهما حدث، وإلا
 * أعادت الإرسال مرارًا فتضاعفت الإجابات على المستخدم.
 */
export async function sendWhatsAppText(to: string, body: string): Promise<boolean> {
  const config = getWhatsAppConfig();
  if (!config) return false;

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizePhone(to),
          type: 'text',
          // 4096 هو سقف واتساب للنص؛ التجاوز يُرجع خطأ لا بترًا
          text: { preview_url: false, body: body.slice(0, 4000) },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      // لا نسجّل نص الرسالة — قد يحمل محتوى مستند
      logger.warn('تعذّر إرسال رسالة واتساب', { status: response.status });
      return false;
    }

    return true;
  } catch (error) {
    logger.warn('تعذّر إرسال رسالة واتساب', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
