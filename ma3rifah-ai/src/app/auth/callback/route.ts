import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * تبديل رمز المصادقة بجلسة.
 *
 * ترسل Supabase الحديثة روابط البريد — استعادة كلمة المرور والدعوة —
 * برمز في مَعلمة `code`، لا برمز في جزء العنوان (hash). والرمز يُبدَّل
 * بجلسة على الخادم مرة واحدة، فتُكتب كعكات الجلسة.
 *
 * بلا هذا المسار تصل الرسالة ويفتح الرابط، ثم لا تجد الصفحة جلسة فتقول
 * «انتهت صلاحية الرابط» مهما كان جديدًا — وهو أسوأ أنواع الأعطال: رسالة
 * خطأ تصف عرضًا صحيحًا وتنسب إليه سببًا خاطئًا، فيُبحث عن العلة في
 * البريد وهي في مسار مفقود.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const errorDescription = searchParams.get('error_description');

  // الوجهة داخلية فقط: قيمة تبدأ بـ// أو بمخطّط تصير إعادة توجيه خارجية
  // يستغلّها التصيّد — رابط من نطاقنا ينقل الضحية إلى موقع مزوّر.
  const requestedNext = searchParams.get('next') ?? '/dashboard';
  const next = /^\/[^/]/.test(requestedNext) ? requestedNext : '/dashboard';

  // العنوان المعلَن أوثق من origin الطلب خلف وسيط، ويسقط إليه عند غيابه
  const base = serverEnv.appUrl.startsWith('http') ? serverEnv.appUrl : origin;

  if (errorDescription) {
    logger.warn('رابط مصادقة مرفوض', { reason: errorDescription.slice(0, 120) });
    return NextResponse.redirect(`${base}/login?error=link_invalid`);
  }

  if (!code) {
    return NextResponse.redirect(`${base}/login?error=link_invalid`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logger.warn('تعذّر تبديل رمز المصادقة بجلسة', { reason: error.message });
    return NextResponse.redirect(`${base}/login?error=link_expired`);
  }

  return NextResponse.redirect(`${base}${next}`);
}
