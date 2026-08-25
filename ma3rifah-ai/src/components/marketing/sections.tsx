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
        'py-16 sm:py-24',
        // على الأرض الداكنة يذوب الفرق بالشفافية وحدها، فيُضاف حدٌّ
        // أعلى وأسفل: القسم يُعرف أنه قسم قبل أن تُقرأ كلمة منه.
        muted && 'border-y border-border/60 bg-muted/70',
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
    <div className={cn('max-w-2xl', align === 'center' ? 'mx-auto text-center' : 'text-start')}>
      {/* لا tracking ولا uppercase على العربية: التباعد يفكّ اتصال
          الحروف بصريًا، وتكبير الأحرف لا معنى له في العربية أصلًا.
          والعلامة شكل هندسي لا محرف بخط آخر — خط واحد في الصفحة. */}
      {eyebrow ? (
        <p
          className={cn(
            'mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground',
            align === 'center' ? 'justify-center' : 'justify-start',
          )}
        >
          <span className="h-px w-5 bg-primary/45" aria-hidden />
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{description}</p>
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
    <div className="rounded-xl border bg-card p-6 transition-shadow hover:shadow-sm">
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-5 text-primary" aria-hidden />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
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
    <section className="relative overflow-hidden border-b bg-gradient-to-b from-accent/40 to-background">
      <div className="tech-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="container relative py-14 sm:py-20">
        <div className="reveal-now mx-auto max-w-3xl text-center">
          {eyebrow ? (
            <p className="mb-3 flex items-center justify-center gap-2 text-sm font-bold text-primary">
              <span className="h-px w-5 bg-primary/45" aria-hidden />
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-balance text-3xl font-bold leading-[1.3] sm:text-4xl">{title}</h1>
          {description ? (
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-loose text-muted-foreground">
              {description}
            </p>
          ) : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
