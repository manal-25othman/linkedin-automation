/**
 * حالة الاشتراك كما تُعرض.
 *
 * الحالة في قاعدة البيانات كلمة واحدة (`TRIALING`, `ACTIVE`, …)، وما
 * يحتاجه المستخدم أكثر: **كم بقي**، و**ماذا يحدث حين ينتهي**، و**ما
 * الإجراء الآن**. وتركُ ذلك للواجهة يجعل كل شاشة تحسبه بطريقتها،
 * فتختلف الأرقام بين اللوحة وصفحة الفوترة على المستخدم نفسه.
 *
 * وأخطر ما هنا **الصمت**: تجربةٌ تنتهي بلا تنبيه تُوقِف العمل فجأة،
 * فيظنّ العميل المنصةَ معطّلة لا اشتراكَه منتهيًا — ويفتح تذكرة دعم بدل
 * أن يشترك. ولذلك تصير الحالة «عاجلة» قبل الانتهاء بثلاثة أيام لا بعده.
 *
 * وحسابٌ خالص بلا إدخال ولا إخراج كي يُختبر.
 */

export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'EXPIRED';

export interface SubscriptionRecord {
  status: SubscriptionStatus;
  /** نهاية الدورة الحالية */
  currentPeriodEnd: string | null;
  /** نهاية التجربة — قد تختلف عن نهاية الدورة */
  trialEndsAt: string | null;
  canceledAt: string | null;
}

/** ما يُبنى عليه العرض */
export interface SubscriptionView {
  status: SubscriptionStatus;
  /** تسمية عربية قصيرة */
  label: string;
  /** جملة تشرح ما يحدث */
  detail: string;
  /** درجة الإلحاح — تحدّد اللون وظهور الشريط */
  tone: 'neutral' | 'info' | 'warning' | 'danger';
  /** أيام متبقية على الحدث القادم — `null` إن لا موعد */
  daysLeft: number | null;
  /** التاريخ الذي تُقاس إليه المدة */
  deadline: string | null;
  /** هل هي تجربة جارية؟ */
  isTrial: boolean;
  /** هل الميزات المدفوعة موقوفة؟ */
  isBlocked: boolean;
  /** هل تستحق شريطًا في أعلى اللوحة؟ */
  showBanner: boolean;
  /** نداء الفعل — `null` إن لا شيء يُفعل */
  cta: { label: string; href: string } | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** يوم كامل يبدأ من الغد: من بقي له ساعتان «يومه الأخير» لا «صفر أيام» */
export function daysUntil(deadline: string | null, now: number): number | null {
  if (!deadline) return null;
  const target = Date.parse(deadline);
  if (!Number.isFinite(target)) return null;
  return Math.ceil((target - now) / DAY_MS);
}

/** صيغة عربية للأيام — تُعرب العدد مع المعدود */
export function formatDaysAr(days: number): string {
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'يوم واحد';
  if (days === 2) return 'يومان';
  return days <= 10 ? `${days} أيام` : `${days} يومًا`;
}

/** يصير التنبيه عاجلًا قبل الانتهاء بثلاثة أيام */
const URGENT_DAYS = 3;

export function describeSubscription(
  subscription: SubscriptionRecord | null,
  now: number = Date.now(),
): SubscriptionView {
  // لا اشتراك أصلًا: حالة لا ينبغي أن تقع، لكنها تقع عند تجهيز ناقص.
  // وعرضُها صريحةً خيرٌ من شاشة بيضاء تُقرأ عطلًا.
  if (!subscription) {
    return {
      status: 'EXPIRED',
      label: 'لا اشتراك',
      detail: 'لم يُربط حساب شركتك بأي خطة بعد. تواصلي مع الدعم لإكمال التجهيز.',
      tone: 'danger',
      daysLeft: null,
      deadline: null,
      isTrial: false,
      isBlocked: true,
      showBanner: true,
      cta: { label: 'تواصلي مع الدعم', href: '/support' },
    };
  }

  const { status } = subscription;

  if (status === 'TRIALING') {
    // نهاية التجربة أولى بالاعتبار من نهاية الدورة إن وُجدت
    const deadline = subscription.trialEndsAt ?? subscription.currentPeriodEnd;
    const daysLeft = daysUntil(deadline, now);

    // انتهت المدة والحالة لم تُحدَّث بعد — تُعامَل معاملة المنتهية.
    // والاعتماد على تحديث الحالة وحده يمنح أيامًا مجانية لمن تأخّرت
    // عنه المهمة المجدولة.
    if (daysLeft !== null && daysLeft <= 0) {
      return {
        status: 'EXPIRED',
        label: 'انتهت التجربة',
        detail:
          'انتهت تجربتك المجانية. بياناتك ومستنداتك محفوظة كما هي — اختاري خطة للمتابعة.',
        tone: 'danger',
        daysLeft: 0,
        deadline,
        isTrial: false,
        isBlocked: true,
        showBanner: true,
        cta: { label: 'اختيار خطة', href: '/settings/billing' },
      };
    }

    const urgent = daysLeft !== null && daysLeft <= URGENT_DAYS;

    return {
      status,
      label: 'تجربة مجانية',
      detail:
        daysLeft === null
          ? 'تجربتك المجانية جارية.'
          : `تنتهي تجربتك بعد ${formatDaysAr(daysLeft)}. بعدها تتوقف الأسئلة الجديدة، ولا تُحذف بياناتك.`,
      tone: urgent ? 'warning' : 'info',
      daysLeft,
      deadline,
      isTrial: true,
      isBlocked: false,
      // الشريط عند الاقتراب وحده: شريطٌ دائم يُتجاهَل بعد يومين
      showBanner: urgent,
      cta: { label: 'اختيار خطة', href: '/settings/billing' },
    };
  }

  if (status === 'ACTIVE') {
    const daysLeft = daysUntil(subscription.currentPeriodEnd, now);

    // اشتراك أُلغي ولم تنتهِ دورته: يعمل حتى نهايتها ثم يتوقف
    if (subscription.canceledAt) {
      return {
        status,
        label: 'مُلغى — يعمل حتى نهاية الدورة',
        detail:
          daysLeft === null
            ? 'ألغيتِ التجديد. يبقى الاشتراك عاملًا حتى نهاية الدورة الحالية.'
            : `ألغيتِ التجديد. يبقى الاشتراك عاملًا ${formatDaysAr(daysLeft)} حتى نهاية الدورة.`,
        tone: 'warning',
        daysLeft,
        deadline: subscription.currentPeriodEnd,
        isTrial: false,
        isBlocked: false,
        showBanner: daysLeft !== null && daysLeft <= URGENT_DAYS,
        cta: { label: 'إعادة تفعيل الاشتراك', href: '/settings/billing' },
      };
    }

    return {
      status,
      label: 'نشط',
      detail:
        daysLeft === null
          ? 'اشتراكك نشط.'
          : `يتجدّد اشتراكك بعد ${formatDaysAr(daysLeft)}.`,
      tone: 'neutral',
      daysLeft,
      deadline: subscription.currentPeriodEnd,
      isTrial: false,
      isBlocked: false,
      showBanner: false,
      cta: null,
    };
  }

  if (status === 'PAST_DUE') {
    return {
      status,
      label: 'تعذّر الدفع',
      detail:
        'لم تُكمَل عملية الدفع الأخيرة. حدّثي وسيلة الدفع لتفادي توقّف الخدمة.',
      tone: 'danger',
      daysLeft: daysUntil(subscription.currentPeriodEnd, now),
      deadline: subscription.currentPeriodEnd,
      isTrial: false,
      // لا يُحجب فورًا: الدفع قد يفشل لسبب عابر، وقطعُ الخدمة عند أول
      // فشل يعاقب عميلًا يدفع على عطلٍ في بطاقته
      isBlocked: false,
      showBanner: true,
      cta: { label: 'إتمام الدفع', href: '/settings/billing' },
    };
  }

  if (status === 'CANCELED') {
    return {
      status,
      label: 'مُلغى',
      detail: 'أُلغي اشتراكك. بياناتك محفوظة — اختاري خطة لاستئناف الخدمة.',
      tone: 'danger',
      daysLeft: null,
      deadline: null,
      isTrial: false,
      isBlocked: true,
      showBanner: true,
      cta: { label: 'اختيار خطة', href: '/settings/billing' },
    };
  }

  return {
    status: 'EXPIRED',
    label: 'منتهٍ',
    detail: 'انتهى اشتراكك. بياناتك ومستنداتك محفوظة — اختاري خطة للمتابعة.',
    tone: 'danger',
    daysLeft: null,
    deadline: null,
    isTrial: false,
    isBlocked: true,
    showBanner: true,
    cta: { label: 'اختيار خطة', href: '/settings/billing' },
  };
}
