import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { settlePayment } from '@/lib/billing/settle';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * عودة المتصفح من صفحة الدفع.
 *
 * كل ما في هذا العنوان قادمٌ من خارجنا — بما فيه `status=paid`. وهو
 * عنوان يستطيع أي أحد كتابته بيده وفتحه. فلا يُقرأ منه إلا **معرّف
 * الدفعة**، ثم يُسأل الخادمُ البوابةَ بنفسه.
 *
 * ولا يُفعَّل شيء هنا استنادًا إلى ما كُتب في العنوان مهما بدا صريحًا.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const base = serverEnv.appUrl.startsWith('http') ? serverEnv.appUrl : origin;

  // معرّف الدفعة لدى Moyasar، ومرجعنا المحلي الذي مرّرناه في callback_url
  const providerPaymentId = searchParams.get('id');
  const localRef = searchParams.get('ref');

  const back = (state: string) =>
    NextResponse.redirect(`${base}/settings/billing?payment=${state}`);

  if (!providerPaymentId) {
    return back('missing');
  }

  try {
    // يُربط معرّف البوابة بصفّنا قبل التسوية. والربط مشروط بأن يكون
    // الصفّ ما زال INITIATED وبلا معرّف — كي لا يُعاد توجيه دفعة قائمة
    // إلى صفّ آخر بعنوان مصنوع.
    if (localRef) {
      const admin = createAdminClient();
      await admin
        .from('payments')
        .update({ provider_payment_id: providerPaymentId })
        .eq('id', localRef)
        .eq('status', 'INITIATED')
        .is('provider_payment_id', null);
    }

    const outcome = await settlePayment(providerPaymentId);

    switch (outcome) {
      case 'ACTIVATED':
      case 'ALREADY_APPLIED':
        return back('success');
      case 'NOT_PAID':
        return back('failed');
      case 'MISMATCH':
        return back('mismatch');
      default:
        return back('pending');
    }
  } catch (error) {
    logger.error('تعذّرت تسوية الدفعة عند العودة', {
      reason: error instanceof Error ? error.message : String(error),
    });
    // «معلّقة» لا «فاشلة»: قد يكون المال قد خُصم فعلًا وتعذّر التحقق
    // عندنا، وإخبار العميل بالفشل حينها خطأ يكلّفه مكالمة دعم.
    return back('pending');
  }
}
