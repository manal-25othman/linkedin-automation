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
      {eyebrow ? (
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
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
