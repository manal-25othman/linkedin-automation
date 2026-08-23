import Link from "next/link";

export type Crumb = { href: string; label: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="مسار التنقّل" className="text-xs text-ink-faint">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="hover:text-signal">
            الرئيسية
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-1.5">
            <span aria-hidden="true">/</span>
            {index === items.length - 1 ? (
              <span className="text-ink-muted">{item.label}</span>
            ) : (
              <Link href={item.href} className="hover:text-signal">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
