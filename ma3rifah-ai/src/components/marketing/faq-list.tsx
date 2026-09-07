import type { FaqItem } from '@/content/faq';

/**
 * قائمة أسئلة شائعة باستخدام details/summary الأصلية:
 * تعمل دون JavaScript، ومفهرسة لمحركات البحث.
 */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <details key={item.question} className="mk-card group px-6 py-1 open:border-primary/40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-start text-base font-semibold marker:content-none">
            {item.question}
            <span
              aria-hidden
              className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <span className="absolute h-0.5 w-3 rounded-full bg-current" />
              <span className="absolute h-3 w-0.5 rounded-full bg-current transition-transform group-open:rotate-90 group-open:opacity-0" />
            </span>
          </summary>
          <p className="pb-5 text-sm leading-loose text-muted-foreground">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
