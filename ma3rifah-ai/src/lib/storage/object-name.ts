/**
 * اسم الكائن داخل التخزين — لاتيني بحت.
 *
 * يتحقّق Supabase من مفتاح التخزين بـ ‎\w‎ بلا راية unicode، أي
 * ‎[A-Za-z0-9_]‎ وحدها، فيرفض أي حرف عربي بـ«Invalid key» ويفشل الرفع
 * كاملًا. وقد كان الاسم يمرّ بـ ‎\p{L}‎ التي تسمح بالعربية، فنجح رفع
 * ملف باسم لاتيني وفشل آخر باسم عربي — والسبب الاسم لا الملف.
 *
 * لا يضيع الاسم العربي: يُحفظ كما كتبته المستخدمة في عمود name، وهو
 * وحده ما يُعرض. وهذا الاسم للتخزين فقط، والتفرّد مضمون بمعرّف
 * المستند في المسار، فلا ضير أن يؤول إلى «document».
 *
 * ويمنع كذلك Path Traversal: تُسقط الأدلة، ولا يبقى محرف شَرطة مائلة.
 */
export function safeStorageObjectName(original: string): string {
  const base = original.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');

  const rawExtension = dot > 0 ? base.slice(dot + 1) : '';
  const extension = /^[A-Za-z0-9]{1,8}$/.test(rawExtension)
    ? `.${rawExtension.toLowerCase()}`
    : '';

  const stem = (dot > 0 ? base.slice(0, dot) : base)
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
    .slice(0, 80);

  return `${stem || 'document'}${extension}`;
}
