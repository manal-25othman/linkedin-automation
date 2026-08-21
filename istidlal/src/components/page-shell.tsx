import { Breadcrumbs, type Crumb } from "./breadcrumbs";

/** إطار موحّد للصفحات النصية (السياسات، عن الموقع، التواصل). */
export function PageShell({
  title,
  lead,
  updated,
  crumbs,
  children,
}: {
  title: string;
  lead?: string;
  updated?: string;
  crumbs: Crumb[];
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={crumbs} />
      <header className="mt-6">
        <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">{title}</h1>
        {lead && <p className="mt-4 text-lg leading-9 text-ink-muted">{lead}</p>}
        {updated && (
          <p className="mt-3 text-xs text-ink-faint numerals-latn">آخر تحديث: {updated}</p>
        )}
      </header>
      <div className="prose mt-10">{children}</div>
    </div>
  );
}
