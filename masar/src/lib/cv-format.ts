/**
 * تحليل السيرة النصّية إلى كتل.
 *
 * النموذج يُخرج تنسيقًا نصّيًا بسيطًا («# الاسم»، «## القسم»، «- نقطة»)،
 * وهذا المُحلِّل هو المصدر الوحيد لفهمه: منه يُبنى ملف Word ومنه تُبنى
 * صفحة الطباعة، فلا يفترق شكل المخرجَين.
 */

export type CvBlockType = 'name' | 'contact' | 'heading' | 'subheading' | 'bullet' | 'paragraph';

export interface CvBlock {
  type: CvBlockType;
  text: string;
}

/** يزيل تشديد ماركداون الذي قد يتسرّب إلى النص */
function stripEmphasis(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/(?<!\*)\*(?!\s)(.+?)(?<!\s)\*/g, '$1');
}

export function parseCv(source: string): CvBlock[] {
  const blocks: CvBlock[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let seenName = false;

  for (const rawLine of lines) {
    const line = stripEmphasis(rawLine.trim());
    if (!line) continue;

    if (line.startsWith('### ')) {
      blocks.push({ type: 'subheading', text: line.slice(4).trim() });
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push({ type: 'heading', text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push({ type: 'name', text: line.slice(2).trim() });
      seenName = true;
      continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      blocks.push({ type: 'bullet', text: line.replace(/^[-*•]\s+/, '').trim() });
      continue;
    }

    // السطر التالي للاسم مباشرةً هو بيانات التواصل عرفًا، ويُنسَّق أصغر
    const previous = blocks[blocks.length - 1];
    const isContactLine = seenName && previous?.type === 'name';
    blocks.push({ type: isContactLine ? 'contact' : 'paragraph', text: line });
  }

  return blocks;
}

/**
 * هل النص عربي في مجمله؟
 *
 * تُقاس نسبة الحروف العربية إلى الحروف الأبجدية وحدها: السيرة العربية
 * مليئة بأسماء تقنيات لاتينية وأرقام، فعدّ كل المحارف يجعلها تبدو إنجليزية.
 */
export function isRtlText(text: string): boolean {
  const arabic = text.match(/[؀-ۿݐ-ݿ]/g)?.length ?? 0;
  const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
  if (arabic + latin === 0) return true; // الواجهة عربية، فالافتراض عربي
  return arabic / (arabic + latin) >= 0.3;
}

/** اسم ملف آمن مشتقّ من اسم صاحب السيرة */
export function cvFileName(blocks: CvBlock[], extension: string): string {
  const name = blocks.find((block) => block.type === 'name')?.text ?? '';
  const cleaned = name
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
    .trim();
  return `${cleaned || 'cv'}.${extension}`;
}
