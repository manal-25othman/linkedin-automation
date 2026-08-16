'use server';

import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { toHalalas, PaymentsNotConfiguredError } from '@/lib/billing/moyasar';
import { AppError, toAppError } from '@/lib/errors';
import { serverEnv } from '@/lib/env';
import { recordAudit } from '@/lib/audit';
import { logger } from '@/lib/logger';

export interface CheckoutResult {
  ok: boolean;
  message?: string;
  /** بيانات نموذج الدفع — المفتاح المنشور فقط، لا السرّي */
  checkout?: {
    paymentRowId: string;
    amountHalalas: number;
    currency: string;
    description: string;
    callbackUrl: string;
    publishableKey: string;
  };
}

/**
 * بدء اشتراك بخطة.
 *
 * يُنشأ صفّ الدفعة **قبل** توجيه العميل إلى البوابة، ويُثبَّت فيه المبلغ
 * المطلوب. هذا ما يجعل التحقق لاحقًا ممكنًا: بلا مرجع محفوظ عندنا لا
 * نملك ما نقارن به ما دُفع، فيصير قبول أي مبلغ هو السلوك الوحيد الممكن.
 *
 * والسعر يُقرأ من قاعدة البيانات لا من الطلب. لو أُخذ من العميل لأمكن
 * لأي أحد أن يشتري الخطة الأعلى بريال — وهو أول ما يُجرَّب على أي متجر.
 */
export async function startCheckoutAction(planId: string): Promise<CheckoutResult> {
  try {
    const { profile, company } = await requirePermission('billing.view');

    if (!serverEnv.isPaymentsConfigured) {
      throw new PaymentsNotConfiguredError();
    }

    const publishableKey = process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY ?? '';
    if (!publishableKey) {
      throw new AppError('INTERNAL', 'بوابة الدفع غير مكتملة الإعداد. تواصل مع الدعم.');
    }

    const supabase = await createClient();
    const { data: plan } = await supabase
      .from('plans')
      .select('id, code, name, price_amount, currency, is_custom_priced, is_public')
      .eq('id', planId)
      .maybeSingle();

    if (!plan || !plan.is_public) {
      throw new AppError('NOT_FOUND', 'الخطة غير متاحة.');
    }

    if (plan.is_custom_priced || plan.price_amount === null) {
      throw new AppError(
        'VALIDATION',
        'هذه الخطة بتسعير حسب الطلب. تواصل معنا لإتمام الاشتراك.',
      );
    }

    const amountHalalas = toHalalas(Number(plan.price_amount));
    if (!Number.isFinite(amountHalalas) || amountHalalas <= 0) {
      throw new AppError('VALIDATION', 'سعر الخطة غير صالح.');
    }

    // مفتاح الخدمة: لا سياسة كتابة على جدول المدفوعات لأي مستخدم — من
    // يكتب صفّ دفع يمنح نفسه اشتراكًا.
    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from('payments')
      .insert({
        company_id: company.id,
        plan_id: plan.id,
        initiated_by: profile.id,
        provider: 'moyasar',
        amount_halalas: amountHalalas,
        currency: plan.currency,
        status: 'INITIATED',
      })
      .select('id')
      .single();

    if (error || !row) {
      logger.error('تعذّر إنشاء صفّ الدفعة', { reason: error?.message });
      throw new AppError('INTERNAL', 'تعذّر بدء عملية الدفع. حاول مرة أخرى.');
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'subscription.checkout_started',
      entityType: 'payment',
      entityId: row.id,
      metadata: { plan: plan.code, amountHalalas },
    });

    return {
      ok: true,
      checkout: {
        paymentRowId: row.id,
        amountHalalas,
        currency: plan.currency,
        description: `اشتراك ${plan.name} — ${company.name}`,
        // معرّفنا يُمرَّر في العنوان كي نربط ردّ البوابة بصفّنا
        callbackUrl: `${serverEnv.appUrl}/billing/callback?ref=${row.id}`,
        publishableKey,
      },
    };
  } catch (error) {
    if (error instanceof PaymentsNotConfiguredError) {
      return {
        ok: false,
        message: 'بوابة الدفع غير مفعّلة بعد. تواصل معنا لإتمام الاشتراك.',
      };
    }
    return { ok: false, message: toAppError(error).message };
  }
}
