/**
 * تحويل صفحة HTML إلى نصّ إعلان وظيفة.
 *
 * مسارَان: بيانات JSON-LD المهيكلة إن وُجدت (تستعملها أغلب أنظمة التوظيف —
 * Greenhouse وLever وWorkday وبيت وwuzzuf)، وإلا تجريد الوسوم. المهيكل
 * أدقّ بكثير: يفصل المسمّى والشركة والموقع عن بقية الصفحة، فلا يدخل النموذجَ
 * شريطُ تنقّل ولا تذييل.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  middot: '·',
  bull: '•',
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

/** يجرّد الوسوم مع الحفاظ على فواصل الأسطر التي تحملها وسوم الكتل */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface StructuredJob {
  title?: string;
  company?: string;
  location?: string;
  employmentType?: string;
  description: string;
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return firstString(record.name ?? record['@value']);
  }
  return undefined;
}

function readLocation(value: unknown): string | undefined {
  if (!value) return undefined;
  const node = Array.isArray(value) ? value[0] : value;
  if (typeof node === 'string') return node.trim() || undefined;
  if (typeof node !== 'object') return undefined;

  const address = (node as Record<string, unknown>).address;
  if (typeof address === 'string') return address.trim() || undefined;
  if (address && typeof address === 'object') {
    const record = address as Record<string, unknown>;
    const parts = [record.addressLocality, record.addressRegion, record.addressCountry]
      .map((part) => firstString(part))
      .filter((part): part is string => Boolean(part));
    if (parts.length > 0) return parts.join('، ');
  }
  return firstString(node);
}

/** يستخرج كل كائنات JSON-LD في الصفحة، بما فيها ما تحت @graph */
function collectJsonLdNodes(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    const raw = match[1];
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(decodeEntities(raw.trim()));
    } catch {
      continue; // بيانات مهيكلة تالفة لا تُبطل بقية الصفحة
    }

    const queue: unknown[] = [parsed];
    while (queue.length > 0) {
      const node = queue.shift();
      if (Array.isArray(node)) {
        queue.push(...node);
      } else if (node && typeof node === 'object') {
        nodes.push(node as Record<string, unknown>);
        const graph = (node as Record<string, unknown>)['@graph'];
        if (graph) queue.push(graph);
      }
    }
  }

  return nodes;
}

export function extractJobPosting(html: string): StructuredJob | null {
  for (const node of collectJsonLdNodes(html)) {
    const type = node['@type'];
    const types = Array.isArray(type) ? type : [type];
    if (!types.some((entry) => typeof entry === 'string' && entry.toLowerCase() === 'jobposting')) {
      continue;
    }

    const description = typeof node.description === 'string' ? htmlToText(node.description) : '';
    if (description.length < 40) continue; // وصف قصير جدًا لا يصلح مصدرًا وحيدًا

    return {
      title: firstString(node.title),
      company: firstString(node.hiringOrganization),
      location: readLocation(node.jobLocation) ?? firstString(node.jobLocationType),
      employmentType: firstString(node.employmentType),
      description,
    };
  }

  return null;
}

/**
 * أقصى طول نصّ يُمرَّر إلى النموذج.
 *
 * الحدّ هنا حماية من صفحة ضخمة تُترجم إلى فاتورة رموز كبيرة، لا حدّ نافذة
 * السياق — الإعلانات الحقيقية أقصر من هذا بكثير.
 */
export const MAX_JOB_TEXT_LENGTH = 24_000;

export function trimJobText(text: string): string {
  return text.length > MAX_JOB_TEXT_LENGTH
    ? `${text.slice(0, MAX_JOB_TEXT_LENGTH)}\n…[قُصّ النص لتجاوزه الحد]`
    : text;
}
