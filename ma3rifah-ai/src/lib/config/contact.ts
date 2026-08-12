/**
 * بيانات التواصل العامة.
 *
 * تُقرأ بمراجع صريحة لا ديناميكية لأن Next.js تستبدل متغيرات
 * NEXT_PUBLIC_ وقت البناء، والقراءة الديناميكية تعود فارغة في المتصفح.
 */

/** رقم واتساب بصيغة دولية بلا + ولا مسافات، مثل 9665xxxxxxxx */
const RAW_WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/[^0-9]/g, '');

export const WHATSAPP_NUMBER = RAW_WHATSAPP.length >= 8 ? RAW_WHATSAPP : '';

export const WHATSAPP_DEFAULT_MESSAGE =
  process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE?.trim() ||
  'السلام عليكم، أرغب في معرفة المزيد عن منصة معرفة AI.';

/** الرابط جاهزًا، أو سلسلة فارغة إذا لم يُضبط الرقم فيُخفى الزر */
export function whatsappLink(message?: string): string {
  if (!WHATSAPP_NUMBER) return '';
  const text = encodeURIComponent(message || WHATSAPP_DEFAULT_MESSAGE);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}
