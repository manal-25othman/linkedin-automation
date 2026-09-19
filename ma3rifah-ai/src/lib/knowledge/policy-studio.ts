import 'server-only';

import { generateAnswer } from '@/lib/ai/claude';
import { neutralizeChunkContent } from '@/lib/ai/prompts';
import { searchReferenceLibrary, type ReferenceMatch } from '@/lib/knowledge/reference-library';
import type { RetrievedChunk } from '@/lib/rag/retrieval';
import { logger } from '@/lib/logger';

/**
 * استوديو السياسات: يكتب مسوّدة سياسة من وثائق الشركة والمكتبة
 * المرجعية الرسمية، ليحرّرها المدير ويعتمدها.
 *
 * وهو لا يُفتي. الفرق بين «يساعد على الكتابة» و«يقول لك ما الحكم»
 * مسؤولية قانونية لا فرق تسويقي، ولذلك:
 *
 *  • كل جملة تنظيمية يجب أن تحمل مصدرها من المكتبة — وما لا مصدر له
 *    يُكتب بصيغة اقتراح داخلي صريحة لا بصيغة إلزام نظامي.
 *  • التنبيه القانوني ثابت أسفل كل مسوّدة، لا خيار فيه.
 *  • لا شيء يُنشر بلا اعتماد إنسان — وهذا محروس في القاعدة لا هنا.
 *
 * ولا بحث في الإنترنت المفتوح: سياسة مبنية على ويب تعني أنظمة قديمة
 * ومصادر مغلوطة. المصدران اثنان لا ثالث لهما: وثائق الشركة، والمكتبة.
 */

export const POLICY_LEGAL_NOTICE =
  'مسودة تنظيمية أُعدّت بمساعدة المنصة استنادًا إلى وثائق الشركة والمراجع ' +
  'النظامية المذكورة. تحتاج مراجعة مختص قبل اعتمادها ملزِمة.';

const MIN_CLARIFICATIONS = 3;
const MAX_CLARIFICATIONS = 5;

export interface PolicyCitation {
  authority: string;
  referenceCode: string | null;
  documentName: string;
  excerpt: string;
}

export interface PolicyDraftResult {
  body: string;
  citations: PolicyCitation[];
  /** المكتبة فارغة أو لم تُطابق — المسوّدة بلا سند نظامي */
  withoutReferences: boolean;
}

/**
 * أسئلة المعالج: ٣–٥ أسئلة يجيب عنها المدير قبل التوليد.
 *
 * غرضها ليس التزيين. السياسة بلا نطاق ولا مبالغ ولا استثناءات نصٌّ
 * عامّ لا يصلح لشركة بعينها — والأسئلة هي ما يحوّل قالبًا إلى سياسة.
 */
export async function generateClarifyingQuestions(
  topic: string,
  companyName: string,
): Promise<string[]> {
  const system =
    'أنت تساعد مديرًا سعوديًا على كتابة سياسة داخلية لشركته. ' +
    `مهمتك أن تسأله ${MIN_CLARIFICATIONS}–${MAX_CLARIFICATIONS} أسئلة قصيرة ومحدّدة ` +
    'يحتاج جوابها قبل أن تُكتب السياسة: النطاق (من تشمل)، والمبالغ أو المدد إن كانت، ' +
    'والشروط، والاستثناءات، وجهة الاعتماد.\n' +
    'اكتب الأسئلة بالعربية الفصحى، سؤالًا في كل سطر، مسبوقًا بشَرطة. ' +
    'لا مقدمة ولا خاتمة ولا ترقيم. ولا تسأل عمّا يمكن استنتاجه من اسم الموضوع.';

  try {
    const completion = await generateAnswer({
      systemPrompt: system,
      history: [],
      userMessage:
        `الشركة: ${neutralizeChunkContent(companyName)}\n` +
        `موضوع السياسة المطلوبة: ${neutralizeChunkContent(topic)}`,
      model: 'claude-haiku-4-5',
      maxTokens: 400,
    });

    const questions = completion.text
      .split('\n')
      .map((line) => line.replace(/^[-–—•*\d.)\s]+/, '').trim())
      .filter((line) => line.length > 8)
      .slice(0, MAX_CLARIFICATIONS);

    return questions.length >= MIN_CLARIFICATIONS ? questions : fallbackQuestions();
  } catch (error) {
    logger.warn('تعذّر توليد أسئلة المعالج — استُعملت الأسئلة الثابتة', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return fallbackQuestions();
  }
}

/**
 * أسئلة ثابتة عند تعذّر التوليد.
 *
 * والارتداد هنا مقصود لا احتياطي: معالجٌ لا يعمل يوقف الميزة كلها،
 * وهذه الأسئلة الخمسة تصلح لأي سياسة موارد بشرية.
 */
function fallbackQuestions(): string[] {
  return [
    'من تشمل هذه السياسة؟ (كل الموظفين، أم فئة أو قسم بعينه؟)',
    'ما المبالغ أو المدد أو النسب التي تريد تثبيتها فيها؟',
    'ما الشروط الواجب توافرها للاستفادة منها؟',
    'ما الاستثناءات التي تريد استبعادها صراحةً؟',
    'من الجهة التي تعتمد الطلبات وفق هذه السياسة؟',
  ];
}

/** يبني قسم المراجع النظامية داخل رسالة المستخدم */
function buildReferenceBlock(matches: ReferenceMatch[]): string {
  if (matches.length === 0) return '';

  const blocks = matches.map((match, index) => {
    const label = match.referenceCode
      ? `${match.authority} — ${match.referenceCode}`
      : match.authority;
    return (
      `[مرجع ${index + 1}] ${label} · ${match.documentName}\n` +
      `${neutralizeChunkContent(match.content)}`
    );
  });

  return `\n\n# المراجع النظامية الرسمية\n<<<مراجع>>>\n${blocks.join('\n\n')}\n<<<نهاية المراجع>>>`;
}

/** يبني قسم وثائق الشركة داخل رسالة المستخدم */
function buildCompanyBlock(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '\n\n# وثائق الشركة\nلا توجد وثائق ذات صلة — الشركة لم توثّق هذا الموضوع بعد.';
  }

  const blocks = chunks.map((chunk, index) => {
    const page = chunk.pageNumber ? ` · صفحة ${chunk.pageNumber}` : '';
    return (
      `[وثيقة ${index + 1}] ${chunk.documentName}${page}\n` +
      `${neutralizeChunkContent(chunk.content)}`
    );
  });

  return `\n\n# وثائق الشركة\n<<<وثائق>>>\n${blocks.join('\n\n')}\n<<<نهاية الوثائق>>>`;
}

export interface PolicyDraftInput {
  companyName: string;
  title: string;
  topic: string;
  clarifications: Array<{ question: string; answer: string }>;
  companyChunks: RetrievedChunk[];
}

/**
 * توليد المسوّدة.
 *
 * يبحث في المكتبة بموضوع السياسة، ويجمعه مع مقاطع وثائق الشركة
 * المسترجَعة مسبقًا، ثم يولّد نصًّا **مع تنبيه قانوني ثابت يُلحَق
 * برمجيًّا لا يُطلَب من النموذج** — ما يُطلب من نموذج قد لا يأتي.
 */
export async function generatePolicyDraft(
  input: PolicyDraftInput,
): Promise<PolicyDraftResult> {
  const references = await searchReferenceLibrary(input.topic, 6);

  const system =
    `أنت تساعد إدارة شركة «${input.companyName}» على صياغة مسودة سياسة داخلية.\n\n` +
    '# مصادرك\n' +
    'مصدران لا ثالث لهما: وثائق الشركة المرفقة، والمراجع النظامية الرسمية المرفقة. ' +
    'ولا تستعمل معرفتك العامة بالأنظمة السعودية مصدرًا — إن لم يرد النصّ في المراجع المرفقة فلا تنسبه لنظام.\n\n' +
    '# الاستشهاد\n' +
    'كل جملة تقول «يوجب النظام» أو «وفق النظام» يجب أن تُتبَع بمصدرها هكذا: (الجهة — رقم المادة). ' +
    'وما ليس له مصدر في المراجع، اكتبه بصيغة قرار داخلي: «تقرّر الشركة…» أو «يُعتمد…» — ولا تنسبه إلى نظام.\n\n' +
    '# الشكل\n' +
    'عنوان، ثم: النطاق · التعريفات إن لزمت · الأحكام · الاستثناءات · جهة الاعتماد · تاريخ السريان.\n' +
    'اكتب بالعربية الفصحى الإدارية، موجزًا ومرقّمًا. لا تكتب تمهيدًا ولا خاتمة إنشائية.\n\n' +
    '# ما لا تفعله\n' +
    'لا تخترع مبلغًا ولا مدّة ولا نسبة لم يذكرها المدير ولم ترد في مصدر. ' +
    'إن نقص شيء جوهري فاكتب مكانه «⚠️ يُحدَّد:» ليكمله المدير. ' +
    'ولا تُصدر حكمًا بمخالفة الشركة لنظام — لست جهة إفتاء.';

  const clarificationBlock = input.clarifications
    .filter((item) => item.answer.trim().length > 0)
    .map(
      (item) =>
        `س: ${neutralizeChunkContent(item.question)}\nج: ${neutralizeChunkContent(item.answer)}`,
    )
    .join('\n\n');

  const userMessage =
    `# السياسة المطلوبة\n${neutralizeChunkContent(input.title)}\n\n` +
    `# الموضوع\n${neutralizeChunkContent(input.topic)}\n\n` +
    `# ما حدّده المدير\n${clarificationBlock || 'لم يُحدَّد شيء.'}` +
    buildCompanyBlock(input.companyChunks) +
    buildReferenceBlock(references);

  const completion = await generateAnswer({
    systemPrompt: system,
    history: [],
    userMessage,
    maxTokens: 3000,
  });

  const drafted = completion.text.trim();

  // التنبيه يُلحَق هنا لا يُطلب من النموذج: الحاجز الذي يعتمد على
  // امتثال نموذجٍ ليس حاجزًا.
  const body = `${drafted}\n\n---\n\n> ⚠️ ${POLICY_LEGAL_NOTICE}`;

  const citations: PolicyCitation[] = references.map((match) => ({
    authority: match.authority,
    referenceCode: match.referenceCode,
    documentName: match.documentName,
    excerpt: match.content.slice(0, 400),
  }));

  return { body, citations, withoutReferences: references.length === 0 };
}
