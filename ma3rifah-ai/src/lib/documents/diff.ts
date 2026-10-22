/**
 * مقارنة إصدارين من وثيقة — حسابًا لا توليدًا.
 *
 * القرار المركزي في هذا الملف سطرٌ واحد: **الفرق يُحسب هنا، والنموذج
 * يصوغه نثرًا ولا يحسبه**.
 *
 * ونموذجٌ يُسأل «ما الفرق بين هذين النصّين» يُجيب جوابًا معقول المظهر
 * يُسقط بندًا ويبدّل رقمًا، ولا يُعلم أنه فعل. ومقارنةُ لائحةٍ مبنيّةٌ
 * على جواب نموذج هي عين ما يَعِد هذا المنتج بألّا يفعله.
 *
 * وما يُقارَن هو **النصّ المفهرَس** لا الملف الأصلي: المقاطع هي ما
 * تُبنى منه الإجابات، فالفرق بينها هو الفرق الذي يراه الموظف فعلًا.
 * وفرقٌ في الملف لم يصل إلى الفهرسة ليس فرقًا في سلوك المنصّة.
 */

import { contentTokens, extractNumbers, jaccard, normalizeArabic } from '@/lib/rag/verify';
import type {
  DocumentDiff,
  DocumentNumberChange,
  DocumentParagraphChange,
} from '@/types/database';

/** تُقارن النتيجة المخزَّنة بهذا، فلا تُعرض نتيجةُ خوارزميةٍ أقدم */
export const DIFF_ALGORITHM = 'paragraph-token-match@1';

/** فوقه تُعدّ الفقرتان فقرةً واحدة تغيّرت، لا حذفًا وإضافة */
const PAIRING_SIMILARITY = 0.45;

/** حدّ الفقرات في كل إصدار — فوقه يُكتفى بما قيس ويُعلَن أنه ناقص */
const MAX_PARAGRAPHS = 1500;

/** أكثر ما يُرشَّح لفقرةٍ واحدة قبل القياس الكامل */
const MAX_CANDIDATES = 12;

/** أقصى تداخلٍ يُبحث عنه بين مقطعين متتاليين — تقطيعُ النصّ يُكرّره */
const MAX_CHUNK_OVERLAP = 240;

/**
 * إعادة بناء نصّ الإصدار من مقاطعه المفهرسة.
 *
 * التقطيع يُضيف تداخلًا بين كل مقطعين (آخر ١٨٠ محرفًا تتكرّر في أول
 * التالي)، فجمعُ المقاطع كما هي يُنتج فقراتٍ مضاعفة على الجانبين.
 * وهي تتقابل فيما بينها فلا تُفسد النتيجة، لكنها تُضخّم العدّ وتُبطئ
 * المطابقة بلا فائدة. فيُقصّ التكرار بأطول لاحقةٍ من السابق تطابق
 * سابقةَ التالي.
 */
export function joinChunkText(chunks: { content: string }[]): string {
  let text = '';

  for (const chunk of chunks) {
    const next = chunk.content;

    if (text.length === 0) {
      text = next;
      continue;
    }

    const window = Math.min(MAX_CHUNK_OVERLAP, text.length, next.length);
    let overlap = 0;
    for (let length = window; length > 16; length -= 1) {
      if (text.endsWith(next.slice(0, length))) {
        overlap = length;
        break;
      }
    }

    text = `${text}\n${next.slice(overlap)}`;
  }

  return text;
}

/** تقسيم النصّ إلى فقرات: سطرٌ غير فارغ = فقرة */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0);
}

/** مفتاح التطابق التامّ: مُطبَّعًا بلا تشكيل ولا فروق رسم */
function exactKey(paragraph: string): string {
  return normalizeArabic(paragraph).replace(/\s+/g, ' ').trim();
}

/** الأرقام الحاملة لمعطًى — القاعدة نفسها المستعملة في التحقق */
function meaningfulNumbers(text: string): string[] {
  return [...extractNumbers(text)].filter((value) => {
    const numeric = Number(value);
    return !(Number.isInteger(numeric) && numeric >= 0 && numeric <= 20);
  });
}

/**
 * حساب الفرق بين إصدارين.
 *
 * على ثلاث مراحل، والترتيب مقصود:
 *
 *   ١) **التطابق التامّ** — الفقرة الموجودة نصًّا في الإصدارين تُشطب
 *      من الطرفين. وهذا يحسم معظم الوثيقة بثمنٍ خطّي، فلا يدخل
 *      القياسَ الباهظَ إلا ما تغيّر فعلًا.
 *
 *   ٢) **الترشيح بالمفردات** — لكل فقرة باقية في الأحدث، لا تُقاس إلا
 *      فقراتٌ تشاركها مفردةً معنوية على الأقل. والقياس الكامل بلا
 *      ترشيح تربيعيّ: وثيقةٌ من ألف فقرة تعني مليون مقارنة مجموعات.
 *
 *   ٣) **الاقتران** — تُقرن الفقرتان الأقرب إن تجاوز تشابههما العتبة،
 *      وتُعدّان فقرةً تغيّرت. وما بقي بلا قرين: مضافٌ أو محذوف.
 *
 * والعتبة متوسطة عمدًا: رفعُها يجعل تعديلًا صغيرًا «حذفًا وإضافة»
 * فيضيع أنّ الفقرة هي هي وقد تبدّل رقمها — وهو أهمّ ما تُطلب له
 * المقارنة أصلًا.
 */
export function computeDocumentDiff(fromText: string, toText: string): DocumentDiff {
  const fromAll = splitParagraphs(fromText);
  const toAll = splitParagraphs(toText);

  const truncated = fromAll.length > MAX_PARAGRAPHS || toAll.length > MAX_PARAGRAPHS;
  const fromParagraphs = fromAll.slice(0, MAX_PARAGRAPHS);
  const toParagraphs = toAll.slice(0, MAX_PARAGRAPHS);

  // --- ١) التطابق التامّ ---
  const fromRemaining = new Set(fromParagraphs.keys());
  const toRemaining = new Set(toParagraphs.keys());

  const byKey = new Map<string, number[]>();
  for (const index of fromRemaining) {
    const key = exactKey(fromParagraphs[index]);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(index);
    else byKey.set(key, [index]);
  }

  let unchanged = 0;

  for (const index of [...toRemaining]) {
    const bucket = byKey.get(exactKey(toParagraphs[index]));
    const match = bucket?.shift();
    if (match === undefined) continue;
    fromRemaining.delete(match);
    toRemaining.delete(index);
    unchanged += 1;
  }

  // --- ٢) فهرس مقلوب على المفردات المعنوية ---
  const fromTokens = new Map<number, Set<string>>();
  const postings = new Map<string, number[]>();

  for (const index of fromRemaining) {
    const tokens = contentTokens(fromParagraphs[index]);
    fromTokens.set(index, tokens);
    for (const token of tokens) {
      const bucket = postings.get(token);
      if (bucket) bucket.push(index);
      else postings.set(token, [index]);
    }
  }

  // --- ٣) الاقتران ---
  const changed: DocumentParagraphChange[] = [];

  for (const index of [...toRemaining]) {
    const tokens = contentTokens(toParagraphs[index]);
    if (tokens.size === 0) continue;

    const shared = new Map<number, number>();
    for (const token of tokens) {
      for (const candidate of postings.get(token) ?? []) {
        if (!fromRemaining.has(candidate)) continue;
        shared.set(candidate, (shared.get(candidate) ?? 0) + 1);
      }
    }

    const ranked = [...shared.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CANDIDATES);

    let bestIndex = -1;
    let bestScore = 0;

    for (const [candidate] of ranked) {
      const score = jaccard(tokens, fromTokens.get(candidate) ?? new Set());
      if (score > bestScore) {
        bestScore = score;
        bestIndex = candidate;
      }
    }

    if (bestIndex < 0 || bestScore < PAIRING_SIMILARITY) continue;

    fromRemaining.delete(bestIndex);
    toRemaining.delete(index);
    changed.push({
      before: fromParagraphs[bestIndex],
      after: toParagraphs[index],
      similarity: Number(bestScore.toFixed(4)),
    });
  }

  // --- الأرقام المتبدّلة ---
  const numberChanges: DocumentNumberChange[] = [];

  for (const change of changed) {
    const before = meaningfulNumbers(change.before);
    const after = meaningfulNumbers(change.after);

    const removedNumbers = before.filter((value) => !after.includes(value));
    const addedNumbers = after.filter((value) => !before.includes(value));

    if (removedNumbers.length === 0 && addedNumbers.length === 0) continue;

    numberChanges.push({
      before: change.before,
      after: change.after,
      removedNumbers,
      addedNumbers,
    });
  }

  return {
    algorithm: DIFF_ALGORITHM,
    fromParagraphs: fromParagraphs.length,
    toParagraphs: toParagraphs.length,
    added: [...toRemaining].sort((a, b) => a - b).map((index) => toParagraphs[index]),
    removed: [...fromRemaining].sort((a, b) => a - b).map((index) => fromParagraphs[index]),
    changed,
    numberChanges,
    unchanged,
    truncated,
  };
}

/** هل في الفرق ما يُعرض أصلًا؟ */
export function isEmptyDiff(diff: DocumentDiff): boolean {
  return (
    diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0
  );
}
