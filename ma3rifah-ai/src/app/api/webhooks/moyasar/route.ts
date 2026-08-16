import { NextResponse, type NextRequest } from 'next/server';
import { readWebhookEnvelope, verifyWebhookSecret } from '@/lib/billing/moyasar';
import { settlePayment } from '@/lib/billing/settle';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * نداء Moyasar عند تغيّر حالة دفعة.
 *
 * ثلاث قواعد تحكم هذا المسار:
 *
 * ١) الرمز المشترك يُتحقَّق منه أولًا. بلا ذلك يصير العنوان بابًا يطرقه
 *    أي أحد بـ«تم الدفع» فيُفعِّل اشتراكًا مجانًا. ورمزٌ غير مضبوط عندنا
 *    يعني رفض الجميع لا قبول الجميع.
 *
 * ٢) لا يُصدَّق شيء ممّا في الحمولة سوى **معرّف الدفعة** — ويُستعمل
 *    للسؤال لا للتصديق. أما «الحالة» في الحمولة فلا تُقرأ أصلًا:
 *    التسوية تسأل البوابة بنفسها.
 *
 * ٣) يُردّ ٢٠٠ في كل الحالات التي عولجت أو لا يفيد فيها التكرار. البوابات
 *    تعيد الإرسال عند أي ردّ غير ناجح، فردُّ خطأٍ على حمولة لا نفهمها
 *    يجلب إعادة إرسال لا تنتهي. ويبقى الرفض ٤٠١ للرمز الخاطئ وحده،
 *    لأنه إشارة صحيحة لصاحب النداء أن يصحّح إعداده.
 */
export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    // حمولة غير صالحة: إعادة إرسالها لن تُصلحها
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const { paymentId, secret } = readWebhookEnvelope(payload);

  // الرمز قد يأتي في ترويسة بدل الحمولة — يُقبل الموضعان
  const headerSecret =
    request.headers.get('x-moyasar-secret') ?? request.headers.get('x-webhook-secret');

  if (!verifyWebhookSecret(secret ?? headerSecret)) {
    logger.warn('نداء webhook مرفوض: رمز غير مطابق');
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!paymentId) {
    logger.warn('نداء webhook بلا معرّف دفعة');
    return NextResponse.json({ received: true }, { status: 200 });
  }

  try {
    const outcome = await settlePayment(paymentId);
    logger.info('عولج نداء webhook للدفع', { outcome });
  } catch (error) {
    logger.error('تعذّرت معالجة نداء webhook', {
      reason: error instanceof Error ? error.message : String(error),
    });
    // خطأ عابر عندنا ⇒ يُطلب من البوابة إعادة المحاولة
    return NextResponse.json({ error: 'retry' }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
