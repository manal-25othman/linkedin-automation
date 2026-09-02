/**
 * أنواع الملفات المقبولة — مصدر واحد للخادم والمتصفح.
 *
 * كانت قائمة الامتدادات مكرّرة في نافذة الرفع، فأُضيفت الصور في الخادم
 * ولم يُضَف شيء في المتصفح: منتقي الملفات كان يحجب الصورة قبل أن تصل
 * إلى أي فحص. هذا الملف بلا `server-only` عمدًا كي يستورده الطرفان.
 */

export const SUPPORTED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xlsx',
  'text/plain': 'txt',
  'text/markdown': 'txt',
  'text/csv': 'csv',
  // الصور تُقرأ ضوئيًا (OCR) — صفحة واحدة لكل صورة
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
};

export const SUPPORTED_EXTENSIONS = [
  'pdf', 'docx', 'xlsx', 'xls', 'txt', 'md', 'csv', 'png', 'jpg', 'jpeg', 'webp',
];

/** قيمة `accept` لمنتقي الملفات في المتصفح — مشتقّة لا مكتوبة باليد */
export const ACCEPT_ATTRIBUTE = SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`).join(',');

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 ميجابايت
