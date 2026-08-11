import type { FaqItem } from '@/content/faq';

/**
 * قائمة أسئلة شائعة باستخدام details/summary الأصلية:
 * تعمل دون JavaScript، ومفهرسة لمحركات البحث.
 */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y rounded-xl border bg-card">
      {items.map((item) => (
        <details key={item.question} className="group px-6 py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-start text-[15px] font-medium marker:content-none">
            {item.question}
            <span
              aria-hidden
              className="relative flex size-5 shrink-0 items-center justify-center"
            >
              <span className="absolute h-0.5 w-3.5 rounded-full bg-muted-foreground" />
              <span className="absolute h-3.5 w-0.5 rounded-full bg-muted-foreground transition-transform group-open:rotate-90 group-open:opacity-0" />
            </span>
          </summary>
          <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
