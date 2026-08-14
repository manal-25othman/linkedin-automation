/**
 * التحقق من رسوخ الإجابة في مصادرها — طبقة مضادة للهلوسة.
 *
 * الموجّه وحده لا يكفي. النموذج يُؤمر ألّا يخترع، ثم يخترع أحيانًا —
 * خصوصًا الأرقام والمُدد، وهي أخطر ما يُختلق في مستند نظامي: «الإشعار
 * ثلاثون يومًا» بدل «خمسة عشر» خطأ يكلّف الشركة، ويبدو للقارئ إجابةً
 * واثقة لا فرق بينها وبين الصحيحة.
 *
 * لذلك يُقاس رسوخ الإجابة بعد توليدها لا قبله. القياس معجمي محلي:
 * لا استدعاء نموذج ثانٍ، فلا تكلفة ولا زمن إضافي، ولا حَكَم قد يهلوس
 * هو أيضًا وهو يحكم على الهلوسة.
 *
 * حدود هذا القياس معروفة ومقصودة: يكشف ما لا أصل له في المصادر، ولا
 * يحكم على صحة الاستنتاج. فهو شرط لازم للثقة لا كافٍ لها.
 */

// =====================================================================
// ١) التطبيع العربي — أساس كل قياس بعده
// =====================================================================

/** تشكيل وعلامات إضافية تُحذف: َ ُ ِ ّ ْ ً ٌ ٍ ٰ وغيرها */
const DIACRITICS = /[ً-ٰٟۖ-ۭ]/g;
/** تطويل الكشيدة — زخرفة لا معنى لها */
const TATWEEL = /ـ/g;

/** أرقام عربية-هندية (٠-٩) وفارسية (۰-۹) → لاتينية */
const DIGIT_MAP: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

/**
 * تطبيع النص العربي.
 *
 * توحيد أشكال الألف والياء والتاء المربوطة ضرورة لا تجميل: المصدر
 * يكتب «الإجازة» والإجابة تكتب «الاجازة»، فبلا توحيد يبدو النص
 * الراسخ غير راسخ، ويصير التحذير ضجيجًا يعتاد المستخدم تجاهله.
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(/[٠-٩۰-۹]/g, (digit) => DIGIT_MAP[digit] ?? digit)
    .replace(/[آأإٱ]/g, 'ا') // آ أ إ ٱ → ا
    .replace(/ى/g, 'ي') // ى → ي
    .replace(/ة/g, 'ه') // ة → ه
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '') // محارف الاتجاه
    .toLowerCase();
}

/**
 * كلمات وظيفية تُحذف قبل القياس.
 *
 * وجودها يرفع التطابق زورًا: إجابة مخترَعة كاملة تشترك مع أي مصدر في
 * «من» و«في» و«التي»، فتبدو راسخة وهي ليست كذلك.
 */
const STOPWORDS = new Set([
  'من', 'الي', 'علي', 'في', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك',
  'التي', 'الذي', 'الذين', 'ما', 'لا', 'لم', 'لن', 'قد', 'كان', 'كانت',
  'يكون', 'تكون', 'هو', 'هي', 'هم', 'او', 'ثم', 'حتي', 'اذا', 'ان',
  'انه', 'كل', 'بعض', 'غير', 'بين', 'عند', 'بعد', 'قبل', 'كما', 'حيث',
  'وفق', 'وفقا', 'بناء', 'يجب', 'يمكن', 'ايضا', 'كذلك', 'لدي', 'به',
  'بها', 'له', 'لها', 'فيه', 'فيها', 'منها', 'منه', 'عليه', 'عليها',
  'the', 'a', 'an', 'of', 'in', 'on', 'to', 'for', 'and', 'or', 'is',
  'are', 'was', 'were', 'be', 'been', 'this', 'that', 'it', 'as', 'by',
  'with', 'from', 'at', 'shall', 'must', 'may', 'can',
]);

/**
 * تجريد خفيف للسوابق.
 *
 * «بالإجازة» و«الإجازة» و«وإجازة» جذرها واحد. التجريد خفيف عمدًا:
 * التجريد العميق يخلط كلمات مختلفة المعنى فيخفي هلوسة حقيقية، وخطأ
 * في هذا الاتجاه أسوأ من تحذير زائد.
 */
function stripAffixes(token: string): string {
  let word = token;

  if (word.length > 5 && /^(وال|بال|كال|فال|لل)/.test(word)) {
    word = word.slice(word.startsWith('لل') ? 2 : 3);
  } else if (word.length > 4 && word.startsWith('ال')) {
    word = word.slice(2);
  } else if (word.length > 4 && /^[وفبكل]/.test(word)) {
    word = word.slice(1);
  }

  return word;
}

/** الرموز ذات المعنى في نص: بلا كلمات وظيفية ولا محارف مفردة */
export function contentTokens(text: string): Set<string> {
  const tokens = normalizeArabic(text)
    .split(/[^\p{L}\p{N}%]+/u)
    .filter((token) => token.length > 0);

  const result = new Set<string>();
  for (const token of tokens) {
    if (STOPWORDS.has(token)) continue;
    const stripped = stripAffixes(token);
    if (stripped.length < 2 || STOPWORDS.has(stripped)) continue;
    result.add(stripped);
  }

  return result;
}

// =====================================================================
// ٢) الأرقام — أخطر ما يُختلق
// =====================================================================

/**
 * استخراج الأرقام بصيغة موحّدة قابلة للمقارنة.
 *
 * تُزال فواصل الآلاف وتُوحَّد الفاصلة العشرية، فيتطابق «1,500» مع
 * «1500» و«١٬٥٠٠». وتُسقط الأصفار اللاحقة كي يتطابق «30.0» مع «30».
 */
export function extractNumbers(text: string): Set<string> {
  const normalized = normalizeArabic(text)
    .replace(/[٬,](?=\d{3}\b)/g, '') // فاصل آلاف
    .replace(/[٫]/g, '.'); // فاصلة عشرية عربية

  const found = normalized.match(/\d+(?:\.\d+)?/g) ?? [];

  const result = new Set<string>();
  for (const raw of found) {
    const value = Number.parseFloat(raw);
    if (Number.isFinite(value)) result.add(String(value));
  }

  return result;
}

export interface NumberVerification {
  /** أرقام وردت في الإجابة ولا أصل لها في المصادر */
  unverified: string[];
  /** مجموع الأرقام في الإجابة */
  total: number;
  /** نسبة المؤكَّد ∈ [0,1] — تساوي ١ حين لا أرقام في الإجابة */
  ratio: number;
}

/**
 * التحقق من أن كل رقم في الإجابة له أصل في المصادر.
 *
 * هذا أعلى الفحوص دقة: الرقم إمّا موجود في المصدر أو مخترَع، بلا
 * منطقة رمادية كالتي في مقارنة المعاني.
 *
 * تُستثنى الأعداد الصغيرة (٠-٢٠) لأنها ترقيم قوائم وترتيب خطوات في
 * الغالب لا معطيات، فإدراجها يغرق التحذير الحقيقي في ضجيج.
 */
export function verifyNumbers(answer: string, sourceText: string): NumberVerification {
  const inAnswer = extractNumbers(answer);
  const inSources = extractNumbers(sourceText);

  const meaningful = [...inAnswer].filter((value) => {
    const numeric = Number(value);
    return !(Number.isInteger(numeric) && numeric >= 0 && numeric <= 20);
  });

  const unverified = meaningful.filter((value) => !inSources.has(value));

  return {
    unverified,
    total: meaningful.length,
    ratio: meaningful.length === 0 ? 1 : 1 - unverified.length / meaningful.length,
  };
}

// =====================================================================
// ٣) معادلات التشابه والرسوخ
// =====================================================================

/** معامل جاكار: |A ∩ B| ÷ |A ∪ B| */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

/** نسبة الاحتواء: |A ∩ B| ÷ |A| — كم من A موجود في B */
export function containment(a: Set<string>, b: Set<string>): number {
  if (a.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / a.size;
}

/**
 * درجة رسوخ الإجابة في مصادرها.
 *
 *     G = |رموز الإجابة ∩ رموز المصادر| ÷ |رموز الإجابة|
 *
 * إجابة كل مفرداتها المعنوية موجودة في المصادر ⇒ G = 1.
 * إجابة مخترَعة من معرفة عامة ⇒ G منخفضة، لأن مفرداتها ليست من المصادر.
 *
 * تُستثنى عبارات المساعد الثابتة («لم أجد معلومات كافية») من الحساب،
 * فهي ليست ادّعاءً عن محتوى المستند ولا يصحّ أن تُخفض الدرجة.
 */
export function groundedness(answer: string, sourceText: string): number {
  const answerTokens = contentTokens(stripAssistantBoilerplate(answer));
  if (answerTokens.size === 0) return 1;
  return containment(answerTokens, contentTokens(sourceText));
}

const BOILERPLATE_PATTERNS = [
  /لم أجد معلومات كافية[^.]*\./g,
  /يُرجى التواصل مع[^.]*\./g,
  /هذه الإجابة ليست من مستندات الشركة[^.]*\./g,
  /⚠️[^\n]*/g,
];

function stripAssistantBoilerplate(answer: string): string {
  return BOILERPLATE_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, ' '),
    answer,
  );
}

// =====================================================================
// ٤) الاستشهادات — أي مصدر استُعمل فعلًا
// =====================================================================

/** يلتقط [مصدر ٣] و[المصدر 3] و[Source 3] */
const CITATION_PATTERN = /\[\s*(?:ال)?(?:مصدر|source)\s*[:#]?\s*([0-9٠-٩]+)\s*\]/gi;

/**
 * أرقام المصادر التي استشهد بها النموذج صراحةً (بادئة من صفر).
 *
 * الاستشهاد الصريح أدقّ بكثير من تخمين المصدر بالتشابه المعجمي، لأنه
 * إقرار النموذج نفسه بما استند إليه.
 */
export function parseCitations(answer: string, sourceCount: number): number[] {
  const cited = new Set<number>();

  for (const match of answer.matchAll(CITATION_PATTERN)) {
    const index = Number.parseInt(normalizeArabic(match[1]), 10) - 1;
    if (Number.isInteger(index) && index >= 0 && index < sourceCount) {
      cited.add(index);
    }
  }

  return [...cited].sort((a, b) => a - b);
}

/** يحذف علامات الاستشهاد من النص المعروض للمستخدم */
export function stripCitationMarkers(answer: string): string {
  return answer
    .replace(CITATION_PATTERN, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ ([،.:؛!؟])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// =====================================================================
// ٥) المعادلة المركّبة — درجة الثقة
// =====================================================================

/**
 * أوزان درجة الثقة.
 *
 * اجتهاد مبني على خطورة كل إشارة لا على معايرة تجريبية — ولا تُعتبر
 * الدرجة مقياسًا مطلقًا بل ترتيبًا نسبيًا بين الإجابات. الرسوخ أثقل
 * لأنه يقيس الإجابة نفسها، والتشابه أخفّ لأنه يقيس ما استُرجع قبل أن
 * تُكتب الإجابة. عدّليها بعد تجميع تقييمات المستخدمين الحقيقية.
 */
export const CONFIDENCE_WEIGHTS = {
  similarity: 0.25,
  groundedness: 0.45,
  numbers: 0.3,
} as const;

export const CONFIDENCE_THRESHOLDS = { high: 0.72, medium: 0.5 } as const;

/** أدنى رسوخ مقبول قبل التحذير الصريح */
export const MIN_GROUNDEDNESS = 0.45;

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface VerificationResult {
  /** درجة مركّبة ∈ [0,1] */
  confidence: number;
  level: ConfidenceLevel;
  groundedness: number;
  maxSimilarity: number;
  numbers: NumberVerification;
  /** فهارس المقاطع التي استُشهد بها فعلًا */
  citedIndexes: number[];
  /** true حين استُنتج الاستشهاد معجميًا لغياب العلامات الصريحة */
  citationsInferred: boolean;
  /** تحذيرات عربية جاهزة للعرض */
  warnings: string[];
}

/**
 * التحقق الكامل من إجابة.
 *
 *     C = Σ(وزنᵢ × قيمةᵢ) ÷ Σ(وزنᵢ)   لكل دليل متوفر
 *
 * فإن حوت الإجابة أرقامًا:
 *     C = (0.25·تشابه + 0.45·رسوخ + 0.30·أرقام_مؤكدة) ÷ 1.00
 * وإلا فلا يدخل حدّ الأرقام أصلًا:
 *     C = (0.25·تشابه + 0.45·رسوخ) ÷ 0.70
 */
export function verifyAnswer(params: {
  answer: string;
  chunks: { content: string; similarity: number }[];
}): VerificationResult {
  const { answer, chunks } = params;
  const sourceText = chunks.map((chunk) => chunk.content).join('\n');

  const maxSimilarity = chunks.reduce((max, chunk) => Math.max(max, chunk.similarity), 0);
  const groundednessScore = groundedness(answer, sourceText);
  const numbers = verifyNumbers(answer, sourceText);

  // --- الاستشهادات ---
  let citedIndexes = parseCitations(answer, chunks.length);
  let citationsInferred = false;

  // لا علامات صريحة ⇒ نستنتج المصادر المدعومة معجميًا بدل أن نعرضها
  // كلها. عرض ستة مصادر لإجابة استعملت واحدًا ادّعاء رسوخ لم يحدث.
  if (citedIndexes.length === 0 && chunks.length > 0) {
    const answerTokens = contentTokens(stripAssistantBoilerplate(answer));
    const supported = chunks
      .map((chunk, index) => ({
        index,
        support: containment(answerTokens, contentTokens(chunk.content)),
      }))
      .filter((entry) => entry.support >= 0.2)
      .sort((a, b) => b.support - a.support)
      .slice(0, 4)
      .map((entry) => entry.index);

    citedIndexes = supported.sort((a, b) => a - b);
    citationsInferred = true;
  }

  // الدرجة متوسط مرجَّح على الأدلة **المتوفرة فعلًا**، لا مجموعًا يُحسب
  // فيه الدليل الغائب كأنه دليل تام. الفرق ليس تجميليًا: إجابة بلا
  // أرقام كانت تنال ٠٫٣٠ مجانًا، فتبلغ إجابة مخترَعة بالكامل درجة
  // «متوسطة» بفضل غياب ما يُدينها — وهو أسوأ ما يمكن أن تفعله درجة ثقة.
  const terms: { weight: number; value: number }[] = [
    { weight: CONFIDENCE_WEIGHTS.similarity, value: maxSimilarity },
    { weight: CONFIDENCE_WEIGHTS.groundedness, value: groundednessScore },
  ];

  if (numbers.total > 0) {
    terms.push({ weight: CONFIDENCE_WEIGHTS.numbers, value: numbers.ratio });
  }

  const totalWeight = terms.reduce((sum, term) => sum + term.weight, 0);
  const confidence =
    terms.reduce((sum, term) => sum + term.weight * term.value, 0) / totalWeight;

  const level: ConfidenceLevel =
    confidence >= CONFIDENCE_THRESHOLDS.high
      ? 'HIGH'
      : confidence >= CONFIDENCE_THRESHOLDS.medium
        ? 'MEDIUM'
        : 'LOW';

  // --- التحذيرات ---
  const warnings: string[] = [];

  if (numbers.unverified.length > 0) {
    warnings.push(
      `تحقّق من هذه الأرقام في المستند الأصلي — لم أجد لها أصلًا في المقاطع المسترجعة: ${numbers.unverified.join('، ')}`,
    );
  }

  if (chunks.length > 0 && groundednessScore < MIN_GROUNDEDNESS) {
    warnings.push(
      'جزء من هذه الإجابة لا يقابله نص صريح في المصادر المسترجعة. راجعها قبل الاعتماد عليها.',
    );
  }

  if (chunks.length > 0 && citedIndexes.length === 0) {
    warnings.push('لم أتمكّن من ربط هذه الإجابة بمقطع محدّد في مستنداتك.');
  }

  return {
    confidence: Number(confidence.toFixed(4)),
    level,
    groundedness: Number(groundednessScore.toFixed(4)),
    maxSimilarity: Number(maxSimilarity.toFixed(4)),
    numbers,
    citedIndexes,
    citationsInferred,
    warnings,
  };
}
