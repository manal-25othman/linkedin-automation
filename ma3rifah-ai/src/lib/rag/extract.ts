import 'server-only';

import { AppError } from '@/lib/errors';
import { ensurePdfRuntimeGlobals } from '@/lib/rag/pdf-runtime';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractionResult {
  /** النص الكامل بعد التنظيف */
  text: string;
  /** مقسّم بالصفحات إن كان المصدر يدعم ذلك (PDF) */
  pages: ExtractedPage[];
  pageCount: number | null;
}

export const SUPPORTED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xlsx',
  'text/plain': 'txt',
  'text/markdown': 'txt',
  'text/csv': 'csv',
};

export const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'xls', 'txt', 'md', 'csv'];

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 ميجابايت

export function detectFileKind(fileName: string, mimeType?: string): string | null {
  if (mimeType && SUPPORTED_MIME_TYPES[mimeType]) return SUPPORTED_MIME_TYPES[mimeType];

  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension) return null;

  switch (extension) {
    case 'pdf':
      return 'pdf';
    case 'docx':
    case 'doc':
      return 'docx';
    case 'xlsx':
    case 'xls':
      return 'xlsx';
    case 'csv':
      return 'csv';
    case 'txt':
    case 'md':
      return 'txt';
    default:
      return null;
  }
}

/**
 * تنظيف النص المستخرج.
 *
 * يعالج مشاكل شائعة في مستندات PDF العربية:
 * محارف التحكم في اتجاه النص، المسافات المكرّرة، وفواصل الأسطر المفرطة.
 */
export function cleanText(raw: string): string {
  return raw
    .replace(/\u0000/g, '')
    // محارف الاتجاه غير المرئية — مكتوبة بالهروب لا بذاتها، إذ محرفٌ
    // غير مرئيّ في الشيفرة لا يُرى حين يضيع في نقلٍ أو تحرير
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * استخراج نص PDF مع معالجة صحيحة للعربية.
 *
 * تُخرج pdf.js نص كل رسم على حدة، وتفكّ روابط الحروف (لام-ألف) وعلامات
 * التشكيل إلى عنصر واحد يحمل حرفين بترتيب معكوس: «لا» تصير «ال»
 * و«اً» تصير «ًا». أثر ذلك ليس تجميليًا — «خلافات» تُخزَّن «خالفات»،
 * فلا يشبه متجهها متجه السؤال المكتوب صحيحًا، فيفشل الاسترجاع ويقول
 * المساعد «لم أجد معلومات» عن نص موجود فعلًا في المستند.
 *
 * كما لا تُخرج pdf.js مسافات بين الكلمات في هذه الملفات: كل حرف رسم
 * مستقل، فتُستنتج المسافات من الفجوات الأفقية بين الرسوم.
 */

/** ألف بأشكالها: آ أ إ ا */
const ALEF_FORMS = new Set(['\u0622', '\u0623', '\u0625', '\u0627']);
const LAM = '\u0644';
/** علامات التشكيل والحركات — تأتي بعد حرفها لا قبله */
const ARABIC_COMBINING = /^[\u064B-\u065F\u0670]/;

/**
 * تصحيح عنصر نصي واحد.
 *
 * مقصور على العناقيد القصيرة التي تنتج عن فكّ رسم واحد، فلا يمسّ
 * الكلمات الكاملة التي تدمجها pdf.js في الملفات السليمة — قلبُها
 * كان سيفسدها.
 */
export function fixArabicGlyphCluster(str: string): string {
  // رباط لام-ألف: رسم واحد يُفكّ إلى [ألف][لام]، والصواب [لام][ألف].
  // أداة التعريف «ال» تصل دائمًا في عنصرين منفصلين، فلا تلتبس بها.
  if (str.length === 2 && ALEF_FORMS.has(str[0]) && str[1] === LAM) {
    return LAM + str[0];
  }

  // علامة تشكيل سبقت حرفها ⇒ العنقود كله معكوس
  if (str.length >= 2 && ARABIC_COMBINING.test(str)) {
    return [...str].reverse().join('');
  }

  return str;
}

/**
 * إصلاح رباط لام-ألف المقلوب داخل نصّ كامل.
 *
 * `fixArabicGlyphCluster` تعالج الحالة التي تُخرج فيها pdf.js كل رسم
 * عنصرًا مستقلًّا. لكن ملفات أخرى تُخرج العبارة كاملة في عنصر واحد
 * («الباب األول» في عنصر طوله أحد عشر محرفًا)، فلا يقع القلب على
 * عنقود من حرفين ولا تراه تلك الدالّة أصلًا.
 *
 * فالمعالجة هنا على النصّ لا على العنصر، ومقصورة على نمطين لا يحتمل
 * أيّهما تأويلًا آخر — لأن القلب الأعمى يفسد أكثر ممّا يصلح: «سأل»
 * تصير «سلأ» و«إلى» تصير «لإى».
 */
/**
 * ألفاظ العدد التي يفسدها قلب رباط لام-ألف.
 *
 * الصنف الثالث من الفساد — ألفٌ مجرّدة ولام داخل الكلمة — لا يفصله
 * نمط، لأن «خالد» السليمة و«خالفات» المعطوبة سواءٌ في الشكل.
 *
 * لكنّ **ألفاظ العدد** حالة خاصّة تستحقّ الاستثناء:
 *
 *   ١) أثرها ماليّ ونظاميّ مباشر. ورقمٌ خاطئ في لائحة ليس عطلًا
 *      تقنيًّا بل مخالفة.
 *
 *   ٢) وطبقة التحقّق تبحث عن الأرقام في المصدر. فإن كان المصدر يحمل
 *      «ثالثين» والإجابة «ثلاثين»، حذّرت من رقمٍ **صحيح** — والتحذير
 *      الكاذب يعلّم المستخدم تجاهل التحذيرات كلها.
 *
 * والمُدرَج هنا صورٌ **لا وجود لها في العربية أصلًا**، فقلبُها قاطع:
 * «ثالثين» ليست كلمة، بخلاف «ثالث» و«ثالثة» — وهما صحيحتان، فلا
 * تُمَسّان مهما بدا أنهما من العائلة نفسها.
 *
 * وقد ظهر هذا في مستند حقيقي: «تُزاد إلى مدة لا تقل عن ثالثين يوما».
 */
const CORRUPTED_NUMERALS: ReadonlyArray<readonly [string, string]> = [
  ['ثالثين', 'ثلاثين'],
  ['ثالثون', 'ثلاثون'],
  ['ثالثمئة', 'ثلاثمئة'],
  ['ثالثمائة', 'ثلاثمائة'],
];

export function repairLamAlefOrder(text: string): string {
  return (
    text
      // ألفان متتاليتان ثم لام: «األحكام» ⇒ «الأحكام»، «إال» ⇒ «إلا».
      //
      // تتابعُ ألفين داخل كلمة لا يقع في العربية بحال، فوجودهما دليلٌ
      // قاطع على أن اللام كانت بينهما وأن الرباط فُكّ مقلوبًا. ولذلك
      // يشمل النمط الألف بأشكالها الأربعة على الجانبين.
      .replace(/([\u0622\u0623\u0625\u0627])([\u0622\u0623\u0625\u0627])\u0644/g, '$1\u0644$2')
      // كلمة «ال» منفردة: أداة التعريف لا تنفصل عن معرَّفها، فلا تقوم
      // كلمةً وحدها. وأصلها «لا» — وهي من أكثر كلمات النصّ النظاميّ.
      .replace(/(?<![\u0621-\u064A])\u0627\u0644(?![\u0621-\u064A])/g, '\u0644\u0627')
  );
}

/**
 * إصلاح ألفاظ العدد المعطوبة.
 *
 * منفصلةٌ عن `repairLamAlefOrder` لأنها من نوع آخر: تلك قاعدةٌ تُبرهَن،
 * وهذه قائمةٌ تُراجَع. وخلطُهما يُغري بإضافة كلماتٍ ملتبسة إلى قاعدةٍ
 * كان برهانها هو ضمانها.
 */
export function repairCorruptedNumerals(text: string): string {
  let result = text;
  for (const [corrupted, correct] of CORRUPTED_NUMERALS) {
    result = result.split(corrupted).join(correct);
  }
  return result;
}

/**
 * القائمة المُنسَّقة لبقايا قلب لام-ألف.
 *
 * القاعدتان المُبرهَنتان في `repairLamAlefOrder` تمسكان الصنفين
 * القاطعين. ويبقى صنفٌ ثالث لا يفصله نمط: الرباط المقلوب **داخل**
 * الكلمة أو بعد لام الجرّ — حيث «خالل» المعطوبة و«خالد» السليمة
 * سواءٌ في الشكل، فلا قاعدة تفرّق بينهما.
 *
 * ظهر هذا الصنف في مستندات إنتاج حقيقية: «لألجور» و«لالحتساب» في
 * دليل توطين المهن الهندسية، ومقطعان في نظام العمل. والمساعد يقول
 * عنها «لم أجد» والجواب أمام السائل — لأن الفهرس يحمل كلماتٍ لا
 * وجود لها فلا يطابقها سؤال.
 *
 * فكل مُدخَل هنا خضع لفحصٍ واحد قبل قبوله: **هل للصورة المعطوبة
 * قراءةٌ عربية مشروعة؟** إن وُجدت — ولو نادرة — رُفض المُدخَل
 * («السالمة» مثلًا صحيحةٌ مؤنثةَ «سالم»، فلا تُدرَج مهما غلب أن
 * المقصود «السلامة»). وما أُدرج فلعدم وجود القراءة أصلًا: «هؤالء»
 * ليست كلمة، و«ألجور» ليست كلمة، و«الالزم» ليست كلمة — بخلاف
 * «الالتزام» و«الالتحاق» السليمتين اللتين لا تمسّهما المطابقة
 * الحرفية لهذه الجذوع.
 */
export const CURATED_LAM_ALEF: ReadonlyArray<readonly [string, string]> = [
  // جذوع تُطابَق حرفيًا أينما وقعت — «الالئح» تصيب «الالئحة»
  // و«بالالئحة» و«الالئحتين» معًا
  ['الالئح', 'اللائح'],
  ['خالل', 'خلال'],
  ['هؤالء', 'هؤلاء'],
  ['أوالد', 'أولاد'],
  ['البالد', 'البلاد'],
  ['الالزم', 'اللازم'],
  ['الالحق', 'اللاحق'],
  ['إبالغ', 'إبلاغ'],
  ['لألجور', 'للأجور'],
  ['لالحتساب', 'للاحتساب'],
  ['لإلجراء', 'للإجراء'],
  ['لإلدارة', 'للإدارة'],
  ['لإلشراف', 'للإشراف'],
];

/**
 * «وال» المنفردة قبل أفعال النفي الشائعة في النصوص النظامية.
 *
 * أصلها «ولا» («وال يجوز» ⇐ «ولا يجوز»). ولا تُعمَّم كقاعدة لأن
 * «والٍ» (الحاكم) تُكتب «وال» بلا تنوين أحيانًا — فالإصلاح مقيَّد
 * بأفعالٍ بعينها لا يستقيم معها معنى الولاية، وكلها من ألفاظ
 * الأنظمة واللوائح.
 */
const WAW_LA_VERBS =
  'يجوز|تجوز|يحق|يقل|تقل|يزيد|تزيد|يتجاوز|تتجاوز|سيما|يكون|تكون|تسري|يسري|يخل|تخل|يعتد|يعد|تعد|يترتب|يحتسب|تحتسب';
const WAW_LA_PATTERN = new RegExp(
  '(?<![\u0621-\u064A])\u0648\u0627\u0644(?= (?:' + WAW_LA_VERBS + ')(?![\u0621-\u064A]))',
  'g',
);

/**
 * إصلاح بقايا لام-ألف من القائمة المُنسَّقة.
 *
 * منفصلةٌ عن `repairLamAlefOrder` للسبب نفسه الذي فصل ألفاظ العدد:
 * تلك قاعدةٌ تُبرهَن، وهذه قائمةٌ تُراجَع مدخلًا مدخلًا. وخلطُهما
 * يُغري بإضافة الملتبس إلى ما كان برهانُه ضمانَه.
 */
export function repairCuratedLamAlef(text: string): string {
  let result = text;
  for (const [corrupted, correct] of CURATED_LAM_ALEF) {
    result = result.split(corrupted).join(correct);
  }
  return result.replace(WAW_LA_PATTERN, '\u0648\u0644\u0627');
}

interface PdfTextItem {
  str: string;
  dir?: string;
  width?: number;
  height?: number;
  transform?: number[];
  hasEOL?: boolean;
}

/** أدنى فجوة تُعدّ مسافة بين كلمتين، كنسبة من ارتفاع السطر */
const WORD_GAP_RATIO = 0.08;
/** فرق رأسي يُعدّ بعده العنصران على سطرين مختلفين */
const LINE_TOLERANCE = 2;

function renderPageItems(items: PdfTextItem[]): string {
  const parts: string[] = [];
  let previous: PdfTextItem | null = null;

  for (const item of items) {
    const str = item.str ?? '';

    if (str.length === 0) {
      if (item.hasEOL) {
        parts.push('\n');
        previous = null;
      }
      continue;
    }

    if (previous) {
      const previousY = previous.transform?.[5] ?? 0;
      const currentY = item.transform?.[5] ?? 0;

      if (previous.hasEOL || Math.abs(previousY - currentY) > LINE_TOLERANCE) {
        parts.push('\n');
      } else {
        const previousX = previous.transform?.[4] ?? 0;
        const currentX = item.transform?.[4] ?? 0;
        // العربية تُرسم من اليمين لليسار: العنصر التالي على يسار سابقه
        const gap =
          currentX < previousX
            ? previousX - (currentX + (item.width ?? 0))
            : currentX - (previousX + (previous.width ?? 0));

        if (gap >= Math.max(0.5, (item.height ?? 12) * WORD_GAP_RATIO)) {
          parts.push(' ');
        }
      }
    }

    parts.push(fixArabicGlyphCluster(str));
    previous = item;
  }

  return parts.join('');
}

/**
 * تحميل pdf.js في بيئة خادم مبنيّة (bundled).
 *
 * على Node تُعطّل pdf.js العامل (worker) وتحمّل منطقه بـ
 * ‎import("./pdf.worker.mjs")‎ موسومًا بـ webpackIgnore. لا يتتبّع أي
 * مُجمِّع مسارًا كهذا، فلا يُنسخ ملف العامل إلى حزمة النشر ويفشل
 * الاستخراج بـ«Setting up fake worker failed». محليًا ينجح لأن
 * node_modules كاملة على القرص — فرق بيئة آخر لا يكشفه الاختبار.
 *
 * الحل: نستورد العامل باسم حزمة صريح يتتبّعه المُجمِّع فيُنسخ فعلًا، ثم
 * نسجّله في globalThis.pdfjsWorker — وهو المنفذ الذي تفحصه pdf.js أولًا
 * فتستعمله وتترك الاستيراد الديناميكي كليًا.
 */
async function loadPdfjs() {
  // قبل التحميل لا بعده: تُقيَّم بعض مراجع DOM وقت تقييم وحدة pdf.js.
  ensurePdfRuntimeGlobals();

  // يُحمَّل ديناميكيًا: مكتبة Node ثقيلة ولا يجب أن تدخل حزمة العميل.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const scope = globalThis as unknown as Record<string, unknown>;
  if (!scope.pdfjsWorker) {
    scope.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  }

  return pdfjs;
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const pdfjs = await loadPdfjs();

  // خيارات مضبوطة لبيئة الخادم بلا واجهة رسومية: استخراج النص لا يحتاج
  // خطوطًا ولا رسمًا، ومحاولة تحميلها في بيئة معزولة (serverless) سبب
  // شائع لفشل لا علاقة له بسلامة الملف.
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    useSystemFonts: false,
    // لا يُقيَّم أي كود من داخل الملف — المستندات مصدر غير موثوق
    isEvalSupported: false,
    verbosity: 0,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;

  const pages: ExtractedPage[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      // الإصلاح بعد التنظيف: علامات الاتجاه غير المرئية تُزال أولًا،
      // فلا تفصل الألف عن اللام فيفوت النمطُ الحارسَ.
      const text = repairCuratedLamAlef(
        repairCorruptedNumerals(
          repairLamAlefOrder(cleanText(renderPageItems(content.items as PdfTextItem[]))),
        ),
      );
      if (text.length > 0) pages.push({ pageNumber, text });
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }

  return {
    text: cleanText(pages.map((page) => page.text).join('\n\n')),
    pages,
    pageCount: document.numPages ?? pages.length,
  };
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  const text = cleanText(result.value ?? '');
  return { text, pages: [], pageCount: null };
}

async function extractSpreadsheet(buffer: Buffer): Promise<ExtractionResult> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const sections: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim().length === 0) continue;
    sections.push(`## ${sheetName}\n${csv.trim()}`);
  }

  return { text: cleanText(sections.join('\n\n')), pages: [], pageCount: null };
}

async function extractCsv(buffer: Buffer): Promise<ExtractionResult> {
  return { text: cleanText(buffer.toString('utf8')), pages: [], pageCount: null };
}

async function extractPlainText(buffer: Buffer): Promise<ExtractionResult> {
  return { text: cleanText(buffer.toString('utf8')), pages: [], pageCount: null };
}

/**
 * استخراج النص من ملف مستند.
 * يرمي AppError برسالة عربية عند فشل الاستخراج أو عدم دعم النوع.
 */
export async function extractDocumentText(
  buffer: Buffer,
  fileName: string,
  mimeType?: string,
): Promise<ExtractionResult> {
  const kind = detectFileKind(fileName, mimeType);

  if (!kind) {
    throw new AppError(
      'UNSUPPORTED_FILE',
      `نوع الملف غير مدعوم. الأنواع المدعومة: ${SUPPORTED_EXTENSIONS.join('، ')}`,
    );
  }

  let result: ExtractionResult;
  try {
    switch (kind) {
      case 'pdf':
        result = await extractPdf(buffer);
        break;
      case 'docx':
        result = await extractDocx(buffer);
        break;
      case 'xlsx':
        result = await extractSpreadsheet(buffer);
        break;
      case 'csv':
        result = await extractCsv(buffer);
        break;
      default:
        result = await extractPlainText(buffer);
    }
  } catch (error) {
    throw new AppError(
      'DOCUMENT_PROCESSING',
      'تعذّر قراءة محتوى الملف. تأكد أن الملف سليم وغير محمي بكلمة مرور.',
      error instanceof Error ? error.message : String(error),
    );
  }

  const quality = assessExtraction(result);
  if (quality.verdict !== 'OK') {
    throw new AppError('DOCUMENT_PROCESSING', quality.message!, quality.detail);
  }

  return result;
}

/* =====================================================================
   تقدير كفاية الاستخراج
   =====================================================================
   العتبة القديمة كانت عشرين محرفًا **مطلقة**. ومستندٌ من ستّ وأربعين
   صفحة ممسوحة ضوئيًّا يحمل ترويسةً واحدة يتجاوزها، فيُفهرَس ويُعلَن
   «جاهز» وفيه مقطع واحد.

   ثم يسأل المستخدم عن معلومة يراها بعينه في الملف، فيقول المساعد «لم
   أجد معلومات كافية» — وهو صادق: لم يُخزَّن من الملف شيء. لكنّ
   المستخدم يقرؤها عطلًا في الذكاء الاصطناعي، وهي عطلٌ في الاستخراج
   وقع قبله بخطوتين وأُعلن نجاحًا.

   وهذا أسوأ من الفشل الظاهر: الفشل يُرى فيُعاد الرفع، و«جاهز» الكاذبة
   تُصدَّق فتُبنى عليها تجربة كاملة.

   فالمقياس صار نسبيًّا: كم محرفًا لكل صفحة، وكم صفحة أعطت نصًّا أصلًا.
   ===================================================================== */

/** أدنى متوسط محارف للصفحة يُعدّ نصًّا حقيقيًّا لا قشورًا */
const MIN_CHARS_PER_PAGE = 120;

/** أدنى نسبة صفحات تحمل نصًّا */
const MIN_PAGES_WITH_TEXT_RATIO = 0.5;

/**
 * عدد الصفحات الذي يصير القياس النسبيّ عنده ذا معنى.
 *
 * مذكّرة من صفحة أو صفحتين قد تكون قصيرة بحقّ، فلا يُحكم عليها بمتوسط.
 */
const RELATIVE_CHECK_MIN_PAGES = 3;

export interface ExtractionQuality {
  verdict: 'OK' | 'EMPTY' | 'SPARSE';
  charCount: number;
  pageCount: number | null;
  pagesWithText: number;
  charsPerPage: number | null;
  /** رسالة للمستخدم — موجودة حين لا يكون الحكم OK */
  message?: string;
  /** تفصيل للسجلّ لا للعرض */
  detail?: string;
}

export function assessExtraction(result: ExtractionResult): ExtractionQuality {
  const charCount = result.text.trim().length;
  const pageCount = result.pageCount;
  const pagesWithText = result.pages.filter((page) => page.text.trim().length > 0).length;
  const charsPerPage =
    pageCount && pageCount > 0 ? Math.round(charCount / pageCount) : null;

  const base = { charCount, pageCount, pagesWithText, charsPerPage };

  if (charCount < 20) {
    return {
      ...base,
      verdict: 'EMPTY',
      message:
        'لم يُعثر على نص قابل للقراءة في الملف. إذا كان المستند صورة ممسوحة ضوئيًا فهو يحتاج معالجة OCR أولًا.',
      detail: `charCount=${charCount}`,
    };
  }

  // القياس النسبيّ للمستندات المصفَّحة وحدها
  if (pageCount !== null && pageCount >= RELATIVE_CHECK_MIN_PAGES) {
    const ratio = pagesWithText / pageCount;

    if (charsPerPage !== null && charsPerPage < MIN_CHARS_PER_PAGE) {
      return {
        ...base,
        verdict: 'SPARSE',
        message:
          `استُخرج نصّ ضئيل جدًّا: ${charCount} محرفًا من ${pageCount} صفحة ` +
          `(${charsPerPage} للصفحة). الأرجح أن المستند صورة ممسوحة ضوئيًا — ` +
          'حوّليه إلى نصّ ببرنامج OCR ثم أعِد رفعه.',
        detail: `charsPerPage=${charsPerPage} pagesWithText=${pagesWithText}/${pageCount}`,
      };
    }

    if (ratio < MIN_PAGES_WITH_TEXT_RATIO) {
      return {
        ...base,
        verdict: 'SPARSE',
        message:
          `${pagesWithText} صفحة فقط من ${pageCount} فيها نصّ قابل للقراءة. ` +
          'الأرجح أن باقي الصفحات صور ممسوحة ضوئيًا — حوّلي الملف كاملًا ' +
          'ببرنامج OCR ثم أعِد رفعه.',
        detail: `pagesWithText=${pagesWithText}/${pageCount} charsPerPage=${charsPerPage}`,
      };
    }
  }

  return { ...base, verdict: 'OK' };
}
