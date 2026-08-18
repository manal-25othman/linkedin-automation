/**
 * تجميع صفوف قائمة محرَّرة تحت عناوين.
 *
 * المحرِّر يعرض القوائم مسطّحة — صفًّا بعد صفّ — لأن تحرير بنية متشعّبة
 * في واجهة عامّة عذاب. والصفحات تعرضها مجمّعة. فهذه الدالة تصل بينهما.
 *
 * وقاعدتها أن **لا صفّ يضيع**: الصفّ الذي لا يطابق قسمه أيّ عنوان معروف
 * يُنشَأ له قسم باسمه في الآخر. لأن المحرِّرة إن أخطأت حرفًا في اسم القسم
 * فالنتيجة المقبولة أن ترى ما كتبت في مكان غير متوقّع، لا أن يختفي بلا أثر.
 */
export interface Grouped<T> {
  key: string;
  items: T[];
}

export function groupRows<T extends Record<string, string>>(
  rows: T[],
  field: keyof T & string,
  order: string[] = [],
): Grouped<T>[] {
  const buckets = new Map<string, T[]>();

  // الترتيب المطلوب أولًا — فيبقى قسمٌ أُفرِغ من صفوفه محذوفًا لا فارغًا
  for (const key of order) if (!buckets.has(key)) buckets.set(key, []);

  for (const row of rows) {
    const key = (row[field] ?? '').trim();
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  return [...buckets.entries()]
    .filter(([, items]) => items.length > 0)
    .map(([key, items]) => ({ key, items }));
}

/** يقسّم نصًّا متعدّد الأسطر إلى نقاط، ويُسقط الفراغ */
export function toLines(value: string | undefined): string[] {
  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/** يقسّم نصًّا إلى فقرات — الفاصل سطر فارغ */
export function toParagraphs(value: string | undefined): string[] {
  return (value ?? '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}
