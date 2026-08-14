import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <section id={id} className={cn('py-16 sm:py-24', muted && 'bg-muted/30', className)}>
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
            'mb-3 flex items-center gap-2 text-sm font-bold text-primary',
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
