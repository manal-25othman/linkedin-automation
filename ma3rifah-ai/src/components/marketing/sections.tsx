import { Fragment } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toParagraphs } from '@/lib/content/group';

/**
 * نصّ محرَّر متعدّد الفقرات.
 *
 * النصوص الطويلة صارت تُحرَّر من اللوحة، فلم يعد ممكنًا كتابة وسوم HTML
 * حولها في الشيفرة. والفاصل هنا سطر فارغ — وهو ما تفعله المحرِّرة تلقائيًا
 * حين تكتب فقرة جديدة، فلا تحتاج أن تتعلّم شيئًا.
 *
 * ولا يُدعَم من التنسيق إلا التعريض بين نجمتين. والاقتصار مقصود: فتحُ
 * HTML في حقل يُخزَّن ثم يُعرض على صفحة عامة يفتح ثغرة حقن، والقيمة
 * المضافة من التنسيق الحرّ في فقرة تسويقية لا تساوي ذلك الخطر.
 */
export function Prose({
  text,
  className,
  paragraphClassName,
}: {
  text: string;
  className?: string;
  paragraphClassName?: string;
}) {
  const paragraphs = toParagraphs(text);
  if (paragraphs.length === 0) return null;

  return (
    <div className={className}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className={paragraphClassName}>
          {paragraph.split(/\*\*(.+?)\*\*/g).map((part, position) =>
            // الأجزاء الفردية هي ما كان بين النجمتين
            position % 2 === 1 ? (
              <strong key={position} className="font-bold text-foreground">
                {part}
              </strong>
            ) : (
              <Fragment key={position}>{part}</Fragment>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

/**
 * قسم.
 *
 * الإيقاع: مسافة رأسية واسعة وحدٌّ خافت بين الأقسام لا أرضٌ رمادية
 * مصمتة — الأرض المتبدّلة على كل قسم تُقطّع الصفحة إلى صناديق.
 * والقسم «المخفَّف» يأخذ أرضًا أدفأ بدرجة واحدة فيُعرف أنه قسم قبل
 * أن تُقرأ كلمة منه.
 */
export function Section({
  className,
  children,
  muted = false,
  id,
}: {
  className?: string;
  children: React.ReactNode;
  muted?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        'relative py-20 sm:py-28',
        muted && 'border-y border-border/60 bg-muted/50',
        className,
      )}
    >
      <div className="container">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'center' | 'start';
}) {
  return (
    <div className={cn('max-w-3xl', align === 'center' ? 'mx-auto text-center' : 'text-start')}>
      {/* الحاجب حبّةٌ لا سطرٌ مباعَد: لا tracking ولا uppercase على
          العربية — التباعد يفكّ اتصال الحروف بصريًا. */}
      {eyebrow ? (
        <p
          className={cn(
            'mb-5 flex',
            align === 'center' ? 'justify-center' : 'justify-start',
          )}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            {eyebrow}
          </span>
        </p>
      ) : null}
      <h2 className="text-balance text-3xl font-extrabold leading-[1.25] tracking-tight sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {description ? (
        <p className="mt-5 text-pretty text-base leading-loose text-muted-foreground sm:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mk-card lift h-full p-6">
      <div className="mk-icon size-11">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="mt-5 text-base font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

/**
 * صدر موحّد لصفحات التسويق الداخلية.
 *
 * وجوده يوحّد الإيقاع البصري: كل صفحة تبدأ بالنسيج نفسه والمقاسات
 * نفسها، فينتقل الزائر بينها دون أن يشعر أنه غادر الموقع. التوحيد هنا
 * ليس تجميلًا — اختلاف الصفحات في الحجم والتباعد يُقرأ ارتجالًا.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b">
      <div className="mk-mesh pointer-events-none absolute inset-0" aria-hidden />
      <div className="tech-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="container relative py-16 sm:py-24">
        <div className="reveal-now mx-auto max-w-3xl text-center">
          {eyebrow ? (
            <p className="mb-5 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                {eyebrow}
              </span>
            </p>
          ) : null}
          <h1 className="text-balance text-4xl font-extrabold leading-[1.2] tracking-tight sm:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-loose text-muted-foreground sm:text-lg">
              {description}
            </p>
          ) : null}
          {children ? <div className="mt-9">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
