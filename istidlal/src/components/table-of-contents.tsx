import type { Heading } from "@/lib/markdown";

/** جدول محتويات ثابت — بلا جافاسكربت، يعتمد على مراسي العناوين. */
export function TableOfContents({ headings }: { headings: Heading[] }) {
  const items = headings.filter((heading) => heading.level === 2);
  if (items.length < 3) return null;

  return (
    <nav
      aria-label="محتويات المقال"
      className="rounded-2xl border border-line bg-surface-soft p-5 lg:sticky lg:top-24"
    >
      <h2 className="font-display text-sm font-bold text-ink">في هذا المقال</h2>
      <ol className="mt-3 flex flex-col gap-2 text-sm">
        {items.map((heading, index) => (
          <li key={heading.id} className="flex gap-2">
            <span className="text-ink-faint numerals-latn">{index + 1}.</span>
            <a href={`#${heading.id}`} className="text-ink-muted transition hover:text-signal">
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
