/**
 * فرق سطري بين نسختَي السيرة الذاتية.
 *
 * خوارزمية أطول تسلسل مشترك (LCS): تُبقي الأسطر غير المتغيّرة في مكانها
 * وتُظهر الحذف والإضافة حولها. البديل الساذج — مقارنة السطر رقم i بالسطر
 * رقم i — يُظهر المستند كله مختلفًا بمجرد إدراج سطر واحد في أوله.
 */

export type DiffKind = 'same' | 'added' | 'removed';

export interface DiffLine {
  kind: DiffKind;
  text: string;
}

/**
 * حدّ الحجم قبل السقوط إلى مقارنة ساذجة.
 * مصفوفة LCS تكبر بحاصل ضرب الطولين؛ سيرة ذاتية أقصر من هذا بكثير،
 * والحدّ حماية من مُدخل شاذّ لا أكثر.
 */
const MAX_LINES = 1500;

function normalize(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

function naiveDiff(before: string[], after: string[]): DiffLine[] {
  const lines: DiffLine[] = [];
  const length = Math.max(before.length, after.length);

  for (let index = 0; index < length; index += 1) {
    const left = before[index];
    const right = after[index];
    if (left !== undefined && right !== undefined && normalize(left) === normalize(right)) {
      lines.push({ kind: 'same', text: right });
      continue;
    }
    if (left !== undefined) lines.push({ kind: 'removed', text: left });
    if (right !== undefined) lines.push({ kind: 'added', text: right });
  }

  return lines;
}

export function diffLines(beforeText: string, afterText: string): DiffLine[] {
  const before = beforeText.replace(/\r\n?/g, '\n').split('\n');
  const after = afterText.replace(/\r\n?/g, '\n').split('\n');

  if (before.length > MAX_LINES || after.length > MAX_LINES) {
    return naiveDiff(before, after);
  }

  const rows = before.length;
  const columns = after.length;

  // table[i][j] = طول أطول تسلسل مشترك بين before[i..] و after[j..]
  const table: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(columns + 1).fill(0),
  );

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = columns - 1; j >= 0; j -= 1) {
      const rowNext = table[i + 1]!;
      const row = table[i]!;
      row[j] =
        normalize(before[i]!) === normalize(after[j]!)
          ? rowNext[j + 1]! + 1
          : Math.max(rowNext[j]!, row[j + 1]!);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < rows && j < columns) {
    if (normalize(before[i]!) === normalize(after[j]!)) {
      lines.push({ kind: 'same', text: after[j]! });
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      lines.push({ kind: 'removed', text: before[i]! });
      i += 1;
    } else {
      lines.push({ kind: 'added', text: after[j]! });
      j += 1;
    }
  }

  while (i < rows) {
    lines.push({ kind: 'removed', text: before[i]! });
    i += 1;
  }
  while (j < columns) {
    lines.push({ kind: 'added', text: after[j]! });
    j += 1;
  }

  return lines;
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

export function diffStats(lines: DiffLine[]): DiffStats {
  return lines.reduce<DiffStats>(
    (stats, line) => {
      if (line.kind === 'added') stats.added += 1;
      else if (line.kind === 'removed') stats.removed += 1;
      else stats.unchanged += 1;
      return stats;
    },
    { added: 0, removed: 0, unchanged: 0 },
  );
}
