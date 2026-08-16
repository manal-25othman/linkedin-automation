import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * عميل Moyasar.
 *
 * القاعدة الوحيدة التي يقوم عليها هذا الملف: **لا يُصدَّق العميل في أمر
 * الدفع**. المتصفح يعود من البوابة بعنوان يحمل `status=paid`، وذلك
 * العنوان يستطيع أي أحد كتابته بيده. والـwebhook نداءٌ من الشبكة يستطيع
 * أي أحد إرساله. فكلاهما — العودة والنداء — لا يُعامَل خبرًا بل إشارةً
 * إلى أن نسأل نحن.
 *
 * والسؤال يمرّ من الخادم بالمفتاح السري إلى `GET /v1/payments/{id}`،
 * وما يعود منه وحده يُكتب في قاعدة البيانات.
 *
 * ولهذا التصميم فائدة ثانية: صحّة النظام لا تتعلّق بتفاصيل شكل حمولة
 * الـwebhook. لو تغيّرت أسماء حقولها أو نسخة الواجهة، بقي القرار مبنيًا
 * على ردّ موثوق لا على ما وصل في الحمولة.
 */

const API_BASE = 'https://api.moyasar.com/v1';

/** المبالغ بالهللة: الريال × ١٠٠، صحيحًا بلا كسور */
export function toHalalas(amountSar: number): number {
  return Math.round(amountSar * 100);
}

export function fromHalalas(halalas: number): number {
  return halalas / 100;
}

export class PaymentsNotConfiguredError extends Error {
  constructor() {
    super('بوابة الدفع غير مضبوطة');
    this.name = 'PaymentsNotConfiguredError';
  }
}

function authHeader(): string {
  const key = serverEnv.moyasarSecretKey;
  if (!key) throw new PaymentsNotConfiguredError();
  // مصادقة أساسية: المفتاح السري اسمَ مستخدم وكلمة المرور فارغة
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

export interface MoyasarPayment {
  id: string;
  status: string;
  amount: number;
  currency: string;
  description?: string | null;
  source?: { type?: string; message?: string | null } | null;
  metadata?: Record<string, string> | null;
  [key: string]: unknown;
}

/**
 * قراءة دفعة من البوابة — مصدر الحقيقة الوحيد.
 *
 * يُرجع null عند أي تعذّر، ولا يرمي: المُنادي يعامل الغياب رفضًا، وهو
 * الاتجاه الآمن. فالخطأ هنا يجب ألّا يُقرأ «مدفوعة» بحال.
 */
export async function fetchPayment(paymentId: string): Promise<MoyasarPayment | null> {
  try {
    const response = await fetch(`${API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: authHeader() },
      cache: 'no-store',
    });

    if (!response.ok) {
      logger.warn('تعذّرت قراءة الدفعة من البوابة', {
        paymentId,
        status: response.status,
      });
      return null;
    }

    return (await response.json()) as MoyasarPayment;
  } catch (error) {
    logger.warn('تعذّر الاتصال ببوابة الدفع', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** الحالة الوحيدة التي تعني أن المال وصل */
export function isPaid(payment: MoyasarPayment): boolean {
  return payment.status === 'paid';
}

/**
 * التحقق من الرمز المشترك في نداء الـwebhook.
 *
 * غياب الرمز المضبوط عندنا يعني رفض كل نداء، لا قبول كل نداء: webhook
 * بلا تحقق بابٌ يطرقه أي أحد بـ«تم الدفع» فيُفعَّل اشتراك مجانًا.
 * والمقارنة ثابتة الزمن كي لا يُستدلّ على الرمز من فروق التوقيت.
 */
export function verifyWebhookSecret(received: string | null | undefined): boolean {
  const expected = serverEnv.moyasarWebhookSecret;
  if (!expected) {
    logger.warn('نداء webhook مرفوض: MOYASAR_WEBHOOK_SECRET غير مضبوط');
    return false;
  }
  if (!received) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  // الطولان المختلفان يفشلان في timingSafeEqual برمي استثناء، فيُفحصان أولًا
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * استخراج معرّف الدفعة والرمز من حمولة الـwebhook.
 *
 * الحمولة تُقرأ متحفّظًا ومن أكثر من موضع محتمل: صيغتها ليست مضمونة
 * عبر النسخ، والاعتماد على مسار واحد يجعل تغييرًا في الشكل عطلًا
 * صامتًا. وأيًّا كان الموضع، فالمعرّف يُستعمل للسؤال لا للتصديق.
 */
export function readWebhookEnvelope(payload: unknown): {
  paymentId: string | null;
  secret: string | null;
} {
  if (typeof payload !== 'object' || payload === null) {
    return { paymentId: null, secret: null };
  }

  const root = payload as Record<string, unknown>;
  const data = (typeof root.data === 'object' && root.data !== null
    ? (root.data as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const pick = (...keys: string[]): string | null => {
    for (const key of keys) {
      const fromRoot = root[key];
      if (typeof fromRoot === 'string' && fromRoot !== '') return fromRoot;
      const fromData = data[key];
      if (typeof fromData === 'string' && fromData !== '') return fromData;
    }
    return null;
  };

  return {
    paymentId: pick('id', 'payment_id'),
    secret: pick('secret_token', 'shared_secret', 'secret'),
  };
}
