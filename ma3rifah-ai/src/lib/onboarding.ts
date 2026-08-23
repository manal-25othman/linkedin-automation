/**
 * رحلة التجهيز.
 *
 * المسجِّل الجديد كان يصل لوحةً بأصفار. والصفر لا يقول له ماذا يفعل،
 * فيغادر ولا يعود — وهذا أعلى تسرّب في قمع المنتج كله: من لا يصل
 * إجابته الأولى لا يشتري مهما كان المنتج جيدًا.
 *
 * وقاعدة هذا الملف أن الحالة **تُحسَب من البيانات الحقيقية** لا من
 * علامةٍ تُحفَظ عند الضغط. فمن رفع مستندًا ثم حذفه تعود خطوته ناقصة،
 * ومن دخل من جهاز آخر يرى التقدّم نفسه. والعلامة المحفوظة تكذب في
 * الحالتين.
 *
 * وأول خطوة منجزة دائمًا — وليست حشوًا: التقدّم الذي يبدأ من الصفر
 * يُقرأ طريقًا طويلًا، والذي يبدأ من خطوة يُقرأ طريقًا بدأ فعلًا.
 *
 * وحسابٌ خالص بلا إدخال ولا إخراج كي يُختبر.
 */

export interface WorkspaceState {
  usersCount: number;
  documentsCount: number;
  documentsReady: number;
  questionsCount: number;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  done: boolean;
  /** المسار الذي يُنجز الخطوة — لا يظهر للخطوة المنجزة */
  href: string;
  cta: string;
  /** خطوة تحتاج صلاحية إدارة المستندات أو المستخدمين */
  requiresManage: boolean;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  doneCount: number;
  totalCount: number;
  percent: number;
  complete: boolean;
  /** الخطوة التالية المطلوبة — `null` عند الاكتمال */
  next: OnboardingStep | null;
}

export function computeOnboarding(
  state: WorkspaceState,
  options: { canManage: boolean } = { canManage: true },
): OnboardingProgress {
  const all: OnboardingStep[] = [
    {
      id: 'account',
      title: 'أنشأتِ حسابك وشركتك',
      description: 'تمّ — مساحة العمل جاهزة لاستقبال مستنداتك.',
      done: true,
      href: '/settings',
      cta: 'مراجعة بيانات الشركة',
      requiresManage: false,
    },
    {
      id: 'upload',
      title: 'ارفعي أول مستند',
      description: 'سياسة أو دليل إجراءات تعرفينه جيدًا — ليسهل تقييم الإجابات.',
      done: state.documentsCount > 0,
      href: '/documents',
      cta: 'رفع مستند',
      requiresManage: true,
    },
    {
      id: 'indexed',
      title: 'اكتملت فهرسة مستند',
      description: 'المستند يصير قابلًا للسؤال بعد قراءته وتقسيمه — عادةً أقل من دقيقة.',
      done: state.documentsReady > 0,
      href: '/documents',
      cta: 'متابعة حالة المعالجة',
      requiresManage: true,
    },
    {
      id: 'ask',
      title: 'اسألي أول سؤال',
      description: 'اسألي عمّا تعرفين جوابه، وتحقّقي من المصدر والصفحة تحت الإجابة.',
      done: state.questionsCount > 0,
      href: '/assistant',
      cta: 'اسألي المساعد',
      requiresManage: false,
    },
    {
      id: 'invite',
      title: 'ادعي زميلًا',
      description: 'تصل الدعوة إلى بريده، ويضبط كلمة مروره بنفسه.',
      done: state.usersCount > 1,
      href: '/users',
      cta: 'دعوة عضو',
      requiresManage: true,
    },
  ];

  // من لا يملك الإدارة لا تُعرض له خطوة لا يستطيع إنجازها — وإلا صار
  // التقدّم عالقًا عنده بلا سبب ظاهر، وهو إحباط لا تحفيز
  const steps = options.canManage ? all : all.filter((step) => !step.requiresManage);

  const doneCount = steps.filter((step) => step.done).length;
  const totalCount = steps.length;

  return {
    steps,
    doneCount,
    totalCount,
    percent: totalCount === 0 ? 100 : Math.round((doneCount / totalCount) * 100),
    complete: doneCount === totalCount,
    next: steps.find((step) => !step.done) ?? null,
  };
}
