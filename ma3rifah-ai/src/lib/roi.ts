/**
 * حاسبة العائد — بحساب متحفّظ معلَن.
 *
 * أكثر حاسبات العائد أدوات تضخيم: تفترض أن المنصّة تجيب عن **كل** سؤال،
 * وأن كل دقيقة موفَّرة تتحوّل إلى ريال، فتُخرج رقمًا مذهلًا لا يصدّقه
 * المشتري الجادّ — فيخسر البائع الرقمَ والثقةَ معًا.
 *
 * وهذه مبنية على العكس: كل افتراض فيها **ظاهر وقابل للتعديل**، وقيمها
 * الابتدائية متحفّظة، والمعادلة معروضة للزائر. ورقمٌ أصغر يصمد في اجتماع
 * أنفع من رقمٍ أكبر ينهار عند أول سؤال.
 *
 * ---------------------------------------------------------------------
 * أهم افتراضين — وهما اللذان تُخفيهما الحاسبات الأخرى
 *
 *   • **نسبة الإجابة**: لا يُجاب عن كل سؤال. بعضه لا أصل له في المستندات،
 *     وبعضه يحتاج حكمًا بشريًا. والقيمة الابتدائية ٦٠٪ لا ١٠٠٪.
 *
 *   • **الوقت الموفَّر ليس نقدًا**: الساعة المستردَّة لا تصير ريالًا إلا
 *     إذا استُعملت في عمل آخر ذي قيمة. وهذا يُقال للزائر صراحةً في
 *     الواجهة، لا في حاشية.
 * ---------------------------------------------------------------------
 */

/** أسابيع الشهر — ٥٢ ÷ ١٢ */
const WEEKS_PER_MONTH = 4.333;

export interface RoiInputs {
  /** عدد الموظفين الذين سيستعملون المنصّة */
  employees: number;
  /** أسئلة متكرّرة لكل موظف أسبوعيًا */
  questionsPerWeek: number;
  /** الدقائق الضائعة على السؤال الواحد — وقت السائل والمجيب معًا */
  minutesPerQuestion: number;
  /** التكلفة المحمَّلة للساعة بالريال */
  hourlyCostSar: number;
  /** نسبة ما تجيب عنه المنصّة فعلًا ∈ [0,1] */
  answerRate: number;
}

/**
 * القيم الابتدائية — وعتبة التعادل التي كشفتها.
 *
 * قياسُ العتبة أظهر أن الاشتراك يتعادل عند **~٢٫٥ سؤال متكرّر لكل موظف
 * أسبوعيًا** (بخمس عشرة دقيقة للسؤال و٧٥ ريالًا للساعة و٦٠٪ إجابة).
 * وما دونها يُخرج عائدًا سالبًا — وتُعرض النتيجة كما هي لا تُخفى.
 *
 * وهذه ليست مشكلة في الحاسبة: هي حدّ السوق نفسه. الشركة التي لا تتكرّر
 * أسئلتها لا تحتاج هذه المنصّة، وبيعُها لها يُنتج تسرّبًا بعد شهرين.
 * وهو يؤكّد استهداف الشركات كثيفة الإجراءات في ٠٣ بدل أن ينقضه.
 *
 * والقيم أدناه فوق العتبة بقليل لا بكثير — كي يبدأ الزائر من حالة
 * واقعية لا من رقم مُبهر لا يشبه شركته.
 */
export const ROI_DEFAULTS: RoiInputs = {
  employees: 25,
  questionsPerWeek: 3,
  minutesPerQuestion: 15,
  hourlyCostSar: 75,
  answerRate: 0.6,
};

/** حدود المدخلات — تمنع أرقامًا تُخرج نتيجة سخيفة */
export const ROI_BOUNDS = {
  employees: { min: 1, max: 5000 },
  questionsPerWeek: { min: 0, max: 50 },
  minutesPerQuestion: { min: 1, max: 120 },
  hourlyCostSar: { min: 10, max: 2000 },
  answerRate: { min: 0.1, max: 1 },
} as const;

export interface RoiPlan {
  code: 'STARTER' | 'GROWTH' | 'BUSINESS' | 'ENTERPRISE';
  name: string;
  monthlySar: number | null;
  maxUsers: number;
  maxQuestions: number;
}

/**
 * الخطط كما هي في الترحيلة 0025.
 *
 * مكرّرة هنا عمدًا لا مقروءة من القاعدة: الحاسبة صفحةُ تسويق يراها زائر
 * بلا جلسة، وقراءةُ القاعدة لأجلها تضيف نداءً على كل زيارة بلا فائدة.
 * ويحرس التطابقَ اختبارٌ يقرأ الترحيلة نصًّا.
 */
export const ROI_PLANS: RoiPlan[] = [
  { code: 'STARTER', name: 'Starter', monthlySar: 899, maxUsers: 10, maxQuestions: 600 },
  { code: 'GROWTH', name: 'Growth', monthlySar: 2499, maxUsers: 30, maxQuestions: 2000 },
  { code: 'BUSINESS', name: 'Business', monthlySar: 5999, maxUsers: 75, maxQuestions: 6000 },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    monthlySar: null,
    maxUsers: Number.POSITIVE_INFINITY,
    maxQuestions: Number.POSITIVE_INFINITY,
  },
];

export interface RoiResult {
  /** إجمالي الأسئلة المتكرّرة شهريًا قبل أي إجابة */
  questionsPerMonth: number;
  /** ما تجيب عنه المنصّة منها */
  answeredPerMonth: number;
  hoursSavedPerMonth: number;
  savedSar: number;
  /** أصغر خطة تكفي عدد الموظفين والأسئلة معًا */
  plan: RoiPlan;
  /** تكلفة الخطة، و null لخطة تفاوضية */
  planCostSar: number | null;
  /** الوفر بعد خصم الاشتراك، و null إن كانت الخطة تفاوضية */
  netSar: number | null;
  /** كم ريالًا يعود مقابل كل ريال يُدفع، و null للتفاوضية */
  ratio: number | null;
  /** أيام حتى يغطّي الوفرُ اشتراكَ الشهر */
  paybackDays: number | null;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** يُطبَّق على كل مدخل قبل الحساب فلا تدخل قيمة خارج المدى */
export function normalizeInputs(raw: Partial<RoiInputs>): RoiInputs {
  const merged = { ...ROI_DEFAULTS, ...raw };
  return {
    employees: Math.round(
      clamp(merged.employees, ROI_BOUNDS.employees.min, ROI_BOUNDS.employees.max),
    ),
    questionsPerWeek: clamp(
      merged.questionsPerWeek,
      ROI_BOUNDS.questionsPerWeek.min,
      ROI_BOUNDS.questionsPerWeek.max,
    ),
    minutesPerQuestion: clamp(
      merged.minutesPerQuestion,
      ROI_BOUNDS.minutesPerQuestion.min,
      ROI_BOUNDS.minutesPerQuestion.max,
    ),
    hourlyCostSar: clamp(
      merged.hourlyCostSar,
      ROI_BOUNDS.hourlyCostSar.min,
      ROI_BOUNDS.hourlyCostSar.max,
    ),
    answerRate: clamp(merged.answerRate, ROI_BOUNDS.answerRate.min, ROI_BOUNDS.answerRate.max),
  };
}

/**
 * أصغر خطة تكفي.
 *
 * والشرطان معًا لا أحدهما: خطةٌ تسع الموظفين وتضيق بأسئلتهم تتوقّف في
 * منتصف الشهر. واختيارُ خطةٍ أرخص من اللازم في الحاسبة يُنتج عائدًا
 * أجمل ووعدًا لا يصحّ.
 */
export function selectPlan(employees: number, answeredPerMonth: number): RoiPlan {
  return (
    ROI_PLANS.find(
      (plan) => employees <= plan.maxUsers && answeredPerMonth <= plan.maxQuestions,
    ) ?? ROI_PLANS[ROI_PLANS.length - 1]
  );
}

export function computeRoi(raw: Partial<RoiInputs>): RoiResult {
  const input = normalizeInputs(raw);

  const questionsPerMonth =
    input.employees * input.questionsPerWeek * WEEKS_PER_MONTH;
  const answeredPerMonth = questionsPerMonth * input.answerRate;

  // الساعات تُقرَّب **قبل** تحويلها إلى ريال لا بعده.
  //
  // والفرق أقلّ من واحد بالمئة، لكنه الفرق بين حاسبةٍ تُجمع أرقامها
  // المعروضة وحاسبةٍ لا تُجمع: تعرض الواجهة «٦٢ ساعة» و«٤٬٦٨٠ ريالًا»،
  // فيضرب المشتري ٦٢ × ٧٥ ويجد ٤٬٦٥٠ — فيشكّ في الرقم كلّه. ودقّةٌ
  // زائدة تكسر الاتساق المعروض خسارةٌ صافية هنا.
  const hoursSavedPerMonth = Math.round((answeredPerMonth * input.minutesPerQuestion) / 60);
  const savedSar = hoursSavedPerMonth * input.hourlyCostSar;

  const plan = selectPlan(input.employees, answeredPerMonth);
  const planCostSar = plan.monthlySar;

  // الخطة التفاوضية بلا سعر معلن، فلا يُخترع لها رقم كي يظهر عائد
  const netSar = planCostSar === null ? null : savedSar - planCostSar;
  const ratio = planCostSar === null || planCostSar === 0 ? null : savedSar / planCostSar;

  const paybackDays =
    planCostSar === null || savedSar <= 0
      ? null
      : Math.min(30, Math.ceil((planCostSar / savedSar) * 30));

  return {
    questionsPerMonth: Math.round(questionsPerMonth),
    answeredPerMonth: Math.round(answeredPerMonth),
    hoursSavedPerMonth,
    savedSar: Math.round(savedSar),
    plan,
    planCostSar,
    netSar: netSar === null ? null : Math.round(netSar),
    ratio: ratio === null ? null : Number(ratio.toFixed(1)),
    paybackDays,
  };
}

/** تنسيق الريال بأرقام لاتينية وفاصل آلاف — أوضح في جدول أرقام */
export function formatSar(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}
