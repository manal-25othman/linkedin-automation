import 'server-only';

import { defaultSiteText, SITE_TEXT } from '@/content/site-text';
import { hasPublicSupabaseConfig } from '@/lib/supabase/public-env';
import { logger } from '@/lib/logger';

/**
 * قارئ نصوص الموقع.
 *
 * يدمج تجاوزات قاعدة البيانات فوق النصّ الأصلي في الشيفرة. والاتجاه
 * مقصود: النصّ الأصلي هو الأساس، والجدول يحمل ما غُيِّر منه فقط.
 *
 * ولذلك لا يتوقف الموقع على قاعدة البيانات في شيء: تعذّر الاتصال، أو
 * جدول غير موجود، أو ترحيل لم يُطبَّق — كلها تُعيد النصّ الأصلي كاملًا
 * بدل أن تُظهر صفحة فارغة. وصفحةٌ بنصّ قديم أهون بكثير من صفحةٍ بلا نصّ.
 */

export type SiteText = (key: string) => string;

/**
 * يقرأ التجاوزات ويعيد دالة قراءة.
 *
 * تُستدعى مرة واحدة في الصفحة ثم تُمرَّر، فلا يتكرر الاستعلام لكل نصّ.
 */
export async function getSiteText(): Promise<SiteText> {
  const values = defaultSiteText();

  if (hasPublicSupabaseConfig) {
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();
      const { data, error } = await supabase.from('site_content').select('key, value');

      if (error) {
        // لا يُرفع إلى المستخدم: النصّ الأصلي ظهر، والزائر لا يعنيه
        // أن تحريرًا لم يُقرأ. لكنه يُسجَّل كي لا يمرّ صامتًا.
        logger.warn('تعذّرت قراءة تجاوزات محتوى الموقع', { reason: error.message });
      } else {
        for (const row of data ?? []) {
          if (typeof row.value === 'string' && row.value.trim() !== '') {
            values[row.key] = row.value;
          }
        }
      }
    } catch (error) {
      logger.warn('تعذّرت قراءة تجاوزات محتوى الموقع', {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (key: string) => {
    const value = values[key];
    if (value !== undefined) return value;

    // مفتاح غير مسجّل = خطأ برمجي لا خطأ محتوى. يُعاد المفتاح نفسه كي
    // يظهر في الصفحة فيُلاحَظ فورًا، بدل فراغٍ يمرّ إلى الإنتاج.
    logger.warn('مفتاح نصّ غير معرّف', { key });
    return SITE_TEXT[key]?.value ?? key;
  };
}
