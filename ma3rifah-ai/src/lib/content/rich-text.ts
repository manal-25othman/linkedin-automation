/**
 * تحليل نصّ الصفحات التي يصنعها مالك المنصة.
 *
 * المطلوب تنسيقٌ يكفي صفحةً تعريفية — عناوين وفقرات وقوائم وروابط
 * وتعريض — بلا فتح HTML. لأن ما يُكتب هنا يُخزَّن ثم يُعرض على صفحة
 * عامة، وقبول الوسوم يجعل حقل تحرير في اللوحة بابًا لحقن نصّ برمجي على
 * كل زائر. والقيد هنا ليس شحًّا في المزايا بل حدُّ الثقة: نُنسِّق ما
 * نفهمه، ولا نمرّر ما لا نفهمه.
 *
 * والصيغة مألوفة لمن كتب في أي أداة حديثة، ولا تحتاج تعلّمًا:
 *
 *   ## عنوان            سطر يبدأ بمربّعين أو ثلاثة
 *   - عنصر              قائمة نقطية
 *   1. عنصر             قائمة مرقّمة
 *   **عريض**            تعريض داخل السطر
 *   [نصّ](/الرابط)      رابط
 *
 * والفصل بين الفقرات سطر فارغ.
 *
 * وهذا مُحلِّل مستقلّ عن العرض عمدًا: العرض في React لا يُختبر بسهولة،
 * والقرارات هنا — أيّ رابط يُقبل، وأين ينتهي التعريض — هي ما يستحق
 * اختبارًا.
 */

export type InlineSpan =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; text: string; href: string };

export type RichBlock =
  | { kind: 'heading'; level: 2 | 3; spans: InlineSpan[] }
  | { kind: 'paragraph'; spans: InlineSpan[] }
  | { kind: 'list'; ordered: boolean; items: InlineSpan[][] };

/**
 * الروابط المقبولة: مسار داخلي، أو `https`، أو بريد.
 *
 * ويُرفض ما عداه — و`javascript:` أوّلها. ورفضُ الرابط لا يحذف نصّه: يبقى
 * النصّ ظاهرًا بلا رابط، فترى الكاتبة أن شيئًا لم يعمل بدل أن يختفي سطر.
 */
export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (value === '') return false;
  if (value.startsWith('//')) return false; // بروتوكول موروث — قد يصير http
  if (value.startsWith('/') || value.startsWith('#')) return true;
  return /^(https:\/\/|mailto:)/i.test(value);
}

const INLINE_PATTERN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) spans.push({ kind: 'text', text: text.slice(cursor, index) });

    if (match[1] !== undefined) {
      spans.push({ kind: 'bold', text: match[1] });
    } else {
      const label = match[2] ?? '';
      const href = match[3] ?? '';
      spans.push(
        isSafeHref(href)
          ? { kind: 'link', text: label, href: href.trim() }
          : { kind: 'text', text: label },
      );
    }

    cursor = index + match[0].length;
  }

  if (cursor < text.length) spans.push({ kind: 'text', text: text.slice(cursor) });
  return spans.filter((span) => span.kind !== 'text' || span.text !== '');
}

const HEADING = /^(#{2,3})\s+(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^\d+[.)]\s+(.*)$/;

export function parseRichText(source: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ').trim();
    paragraph = [];
    if (text !== '') blocks.push({ kind: 'paragraph', spans: parseInline(text) });
  };

  const flushList = () => {
    if (!list) return;
    const { ordered, items } = list;
    list = null;
    if (items.length > 0) {
      blocks.push({ kind: 'list', ordered, items: items.map(parseInline) });
    }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (line === '') {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: 'heading',
        level: heading[1].length === 2 ? 2 : 3,
        spans: parseInline(heading[2].trim()),
      });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = numbered !== null;
      // تغيّر نوع القائمة يبدأ قائمة جديدة، فلا تختلط نقطية بمرقّمة
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet?.[1] ?? numbered?.[1] ?? '').trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

/** أول فقرة نصًّا مجرّدًا — تصلح وصفًا لمحركات البحث حين لا وصف مكتوب */
export function firstParagraphText(source: string, limit = 160): string {
  const block = parseRichText(source).find((item) => item.kind === 'paragraph');
  if (!block) return '';
  const text = block.spans.map((span) => span.text).join('');
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}
