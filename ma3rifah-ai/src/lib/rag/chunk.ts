import type { ExtractionResult } from '@/lib/rag/extract';

export interface Chunk {
  index: number;
  content: string;
  tokenCount: number;
  pageNumber: number | null;
  sectionTitle: string | null;
}

/**
 * إعدادات التقطيع.
 *
 * الحجم مُختار لتوازن التكلفة والدقة: مقاطع أصغر تعني استرجاعًا أدق
 * لكن سياقًا أقل تماسكًا؛ التداخل يحفظ الجمل التي تقع على الحدود.
 */
export const CHUNK_CONFIG = {
  targetChars: 1200,
  maxChars: 1800,
  minChars: 120,
  overlapChars: 180,
} as const;

/**
 * تقدير عدد الرموز.
 *
 * العربية تستهلك رموزًا أكثر من الإنجليزية لنفس عدد المحارف،
 * لذا نستخدم ~2.6 محرف/رمز بدل ~4 المعتادة في الإنجليزية.
 * التقدير يُستخدم للمراقبة والتحكم في التكلفة فقط — الفوترة الفعلية
 * تأتي من عدّادات المزوّد في الاستجابة.
 */
export function estimateTokens(text: string): number {
  const arabicChars = (text.match(/[؀-ۿ]/g) ?? []).length;
  const ratio = arabicChars > text.length / 3 ? 2.6 : 4;
  return Math.max(1, Math.ceil(text.length / ratio));
}

const HEADING_PATTERN =
  /^(#{1,4}\s+.+|\d+[.)]\s+\S.{0,80}|[؀-ۿA-Za-z][^\n]{0,80}:)$/;

function looksLikeHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 90) return false;
  return HEADING_PATTERN.test(trimmed);
}

function cleanHeading(line: string): string {
  return line.replace(/^#+\s*/, '').replace(/:$/, '').trim();
}

/** يقسّم النص إلى جمل مع الحفاظ على علامات الترقيم العربية */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?؟।۔]|\n)\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/**
 * يقطّع نصًا واحدًا إلى مقاطع متداخلة، محاولًا احترام حدود الفقرات والجمل.
 */
function chunkText(
  text: string,
  startIndex: number,
  pageNumber: number | null,
): Chunk[] {
  const chunks: Chunk[] = [];
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  let buffer = '';
  let currentHeading: string | null = null;
  let index = startIndex;

  const flush = () => {
    const content = buffer.trim();
    if (content.length >= CHUNK_CONFIG.minChars) {
      chunks.push({
        index: index++,
        content,
        tokenCount: estimateTokens(content),
        pageNumber,
        sectionTitle: currentHeading,
      });
      // التداخل: نُبقي ذيل المقطع الحالي بداية للمقطع التالي
      buffer =
        content.length > CHUNK_CONFIG.overlapChars
          ? `${content.slice(-CHUNK_CONFIG.overlapChars)}\n`
          : '';
    } else if (content.length > 0 && chunks.length > 0) {
      // مقطع أقصر من الحد الأدنى يُدمج مع سابقه بدل ضياعه
      const previous = chunks[chunks.length - 1];
      previous.content = `${previous.content}\n${content}`;
      previous.tokenCount = estimateTokens(previous.content);
      buffer = '';
    } else {
      buffer = '';
    }
  };

  for (const paragraph of paragraphs) {
    const lines = paragraph.split('\n');
    if (lines.length > 0 && looksLikeHeading(lines[0])) {
      currentHeading = cleanHeading(lines[0]);
    }

    // فقرة أكبر من الحد الأقصى تُقسّم إلى جمل
    if (paragraph.length > CHUNK_CONFIG.maxChars) {
      for (const sentence of splitIntoSentences(paragraph)) {
        if (buffer.length + sentence.length > CHUNK_CONFIG.targetChars && buffer.length > 0) {
          flush();
        }
        buffer += `${sentence} `;
      }
      continue;
    }

    if (buffer.length + paragraph.length > CHUNK_CONFIG.targetChars && buffer.length > 0) {
      flush();
    }
    buffer += `${paragraph}\n\n`;
  }

  if (buffer.trim().length > 0) {
    const content = buffer.trim();
    if (content.length >= CHUNK_CONFIG.minChars || chunks.length === 0) {
      chunks.push({
        index: index++,
        content,
        tokenCount: estimateTokens(content),
        pageNumber,
        sectionTitle: currentHeading,
      });
    } else {
      const previous = chunks[chunks.length - 1];
      previous.content = `${previous.content}\n${content}`;
      previous.tokenCount = estimateTokens(previous.content);
    }
  }

  return chunks;
}

/**
 * يبني مقاطع مستند كامل.
 * إذا توفّر تقسيم بالصفحات (PDF) نحافظ على رقم الصفحة لكل مقطع،
 * وهذا ما يسمح للمساعد بأن يقول «سياسة الموارد البشرية.pdf — صفحة ٧».
 */
export function buildChunks(extraction: ExtractionResult): Chunk[] {
  if (extraction.pages.length > 0) {
    const chunks: Chunk[] = [];
    for (const page of extraction.pages) {
      const pageChunks = chunkText(page.text, chunks.length, page.pageNumber);
      chunks.push(...pageChunks);
    }
    if (chunks.length > 0) return chunks;
  }

  return chunkText(extraction.text, 0, null);
}
