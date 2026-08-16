import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/types/database';
import { fetchPayment, isPaid } from '@/lib/billing/moyasar';
import { recordAudit } from '@/lib/audit';
import { logger } from '@/lib/logger';

/**
 * تسوية دفعة: نسأل البوابة، ثم نكتب النتيجة، ثم نفعّل الاشتراك.
 *
 * مسار واحد يخدم البابين — عودة المتصفح من صفحة الدفع، ونداء الـwebhook.
 * وتوحيدهما مقصود: لو كُتب لكلٍّ منطقه لتفرّقا مع الوقت، فصار للنظام
 * تعريفان لِـ«مدفوعة» يختلفان في الحالات الطرفية — وهي بالضبط الحالات
 * التي يقع فيها المال في غير موضعه.
 */

export type SettleOutcome = 'ACTIVATED' | 'ALREADY_APPLIED' | 'NOT_PAID' | 'MISMATCH' | 'UNKNOWN';

export async function settlePayment(providerPaymentId: string): Promise<SettleOutcome> {
  const admin = createAdminClient();

  // الصفّ المحلي هو ما يربط الدفعة بشركةٍ وخطةٍ ومبلغٍ طُلب فعلًا.
  // دفعة لا صفّ لها عندنا لا تُفعِّل شيئًا مهما قالت البوابة: قد تكون
  // لحساب آخر على البوابة نفسها، أو معرّفًا مُلفَّقًا.
  const { data: row } = await admin
    .from('payments')
    .select('id, company_id, plan_id, amount_halalas, currency, status, applied_at, initiated_by')
    .eq('provider_payment_id', providerPaymentId)
    .maybeSingle();

  if (!row) {
    logger.warn('تسوية دفعة غير معروفة', { providerPaymentId });
    return 'UNKNOWN';
  }

  if (row.applied_at) return 'ALREADY_APPLIED';

  const payment = await fetchPayment(providerPaymentId);
  if (!payment) return 'UNKNOWN';

  if (!isPaid(payment)) {
    await admin
      .from('payments')
      .update({
        status: 'FAILED',
        failure_reason: payment.source?.message ?? payment.status,
        provider_payload: payment as unknown as Json,
      })
      .eq('id', row.id);
    return 'NOT_PAID';
  }

  // --- المبلغ والعملة يجب أن يطابقا ما طُلب ---
  // بدون هذا الفحص يستطيع من يتلاعب بطلب الإنشاء أن يدفع ريالًا واحدًا
  // ويحصل على خطة بتسعة وتسعين وتسعمئة. المقارنة بالهللة صحيحةً، فلا
  // يدخل خطأ التقريب العشري في المال.
  if (payment.amount !== row.amount_halalas || payment.currency !== row.currency) {
    logger.error('مبلغ الدفعة لا يطابق المطلوب', {
      providerPaymentId,
      expected: `${row.amount_halalas} ${row.currency}`,
      received: `${payment.amount} ${payment.currency}`,
    });

    await admin
      .from('payments')
      .update({
        status: 'FAILED',
        failure_reason: 'المبلغ المدفوع لا يطابق سعر الخطة',
        provider_payload: payment as unknown as Json,
      })
      .eq('id', row.id);

    return 'MISMATCH';
  }

  await admin
    .from('payments')
    .update({
      status: 'PAID',
      paid_at: new Date().toISOString(),
      provider_payload: payment as unknown as Json,
    })
    .eq('id', row.id);

  const { data: activated } = await admin.rpc('activate_subscription_for_payment', {
    p_payment_id: row.id,
  });

  if (!activated) return 'ALREADY_APPLIED';

  await recordAudit({
    companyId: row.company_id,
    actorId: row.initiated_by,
    action: 'subscription.activated',
    entityType: 'payment',
    entityId: row.id,
    metadata: { amountHalalas: row.amount_halalas, currency: row.currency },
  });

  logger.info('فُعِّل اشتراك بعد دفعة مؤكَّدة', { companyId: row.company_id });

  return 'ACTIVATED';
}
