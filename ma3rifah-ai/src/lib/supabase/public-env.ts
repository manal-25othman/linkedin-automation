/**
 * المفاتيح العامة لـSupabase — تُقرأ في المتصفح وعلى الخادم معًا.
 *
 * غيّرت Supabase تسمية المفتاح العام: كان «anon key» وصار «Publishable
 * key» (يبدأ بـsb_publishable_). القيمة واحدة والاسم مختلف، فيقع الناس
 * في خطأ تسمية يعطّل النظام كله دون رسالة مفهومة. لذا نقبل الاسمين.
 *
 * ملاحظة مقصودة: تُكتب المراجع صراحةً (process.env.NEXT_PUBLIC_X) ولا
 * تُقرأ ديناميكيًا (process.env[name])، لأن Next.js تستبدل المراجع
 * الصريحة وحدها بقيمها وقت البناء. القراءة الديناميكية تُرجع undefined
 * في حزمة المتصفح.
 *
 * لا يوضع 'server-only' هنا: هذه القيم عامة بطبيعتها. حماية البيانات
 * تقع على سياسات RLS في قاعدة البيانات لا على إخفاء هذا المفتاح.
 */

function firstNonEmpty(...values: (string | undefined)[]): string {
  for (const value of values) {
    if (value && value.trim() !== '') return value.trim();
  }
  return '';
}

/**
 * تُبنى مسارات الواجهة بالإلحاق (`${url}/rest/v1/...`)، فشرطة زائدة في
 * آخر القيمة تُنتج `//rest/v1` فترفضه بوابة Supabase بـ404 — عطل صامت
 * يبدو كأن الجداول غير موجودة. نزعها هنا يجعل القيمتين متكافئتين.
 */
function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export const PUBLIC_SUPABASE_URL = normalizeBaseUrl(
  firstNonEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL),
);

export const PUBLIC_SUPABASE_ANON_KEY = firstNonEmpty(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

/** هل تكفي الإعدادات العامة لإنشاء عميل Supabase؟ */
export const hasPublicSupabaseConfig =
  PUBLIC_SUPABASE_URL !== '' && PUBLIC_SUPABASE_ANON_KEY !== '';
