import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * تفعيل الإصدارات المستحقّة — مهمة دورية.
 *
 * الاعتماد بتاريخ سريان مستقبلي يثبّت القرار ولا يبدّل المرجع. وهذا
 * المسار هو من يبدّله عند بلوغ الموعد.
 *
 * **واتجاه الفشل مقصود:** لو لم يُشغَّل هذا المسار يومًا، بقي الإصدار
 * القديم يُجيب. فتأخّرُ سياسةٍ جديدة يومًا أهون من سريانها قبل موعدها
 * — ولذلك لا يُبنى الاسترجاع على حساب تاريخ في كل استعلام، بل على
 * مؤشّر صريح يحرّكه هذا المسار.
 *
 * ولا هوية مستخدم هنا: تُنفَّذ بمفتاح الخدمة، والدالّة في القاعدة
 * ممنوعة على كل دور مصادَق. فالحماية سرٌّ مشترك لا جلسة.
 */

/** مقارنة ثابتة الزمن — المقارنة النصية تكشف طول السرّ بالتوقيت */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const expected = serverEnv.internalApiSecret;

  /*
   * السرّ غائب ⇒ المسار مغلق، لا مفتوح.
   *
   * والاتجاه هنا هو ما يهمّ: إعدادٌ ناقص يجب أن يُعطّل الميزة لا أن
   * يفتحها للعامّة. ومسارٌ يبدّل مرجع المعرفة لكل الشركات لا يُترك
   * بلا سرّ لأن أحدًا نسي ضبط متغيّر.
   */
  if (!expected) {
    logger.warn('نداء تفعيل الإصدارات مرفوض: INTERNAL_API_SECRET غير مضبوط');
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  // Vercel Cron يرسل `Authorization: Bearer <CRON_SECRET>`، ويُقبل
  // كذلك رأسٌ صريح للتشغيل اليدوي من سطر الأوامر.
  const header =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    request.headers.get('x-internal-secret') ??
    '';

  if (!secretMatches(header, expected)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('activate_due_document_versions');

    if (error) {
      logger.error('تعذّر تفعيل الإصدارات المستحقّة', { reason: error.message });
      return NextResponse.json({ error: 'failed' }, { status: 500 });
    }

    const activated = data ?? 0;
    if (activated > 0) {
      logger.info('فُعّلت إصدارات مستحقّة', { activated });
    }

    return NextResponse.json({ activated });
  } catch (cause) {
    logger.error('خطأ غير متوقع في تفعيل الإصدارات', {
      reason: cause instanceof Error ? cause.message : String(cause),
    });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
