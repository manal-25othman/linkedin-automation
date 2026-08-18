import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { SearchClient } from "@/components/search-client";
import { getSearchIndex } from "@/lib/articles";

export const metadata: Metadata = {
  title: "البحث",
  description: "ابحث في مقالات استدلال.",
  // صفحات نتائج البحث الداخلي لا تُفهرَس.
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ href: "/search", label: "البحث" }]} />
      <h1 className="mt-6 font-display text-3xl font-bold text-ink">البحث في المقالات</h1>
      <p className="mt-3 text-ink-muted">
        الفهرس مبنيّ وقت البناء ويعمل داخل متصفّحك — لا يُرسل ما تكتبه إلى أي خادم.
      </p>
      <div className="mt-8">
        <SearchClient index={getSearchIndex()} />
      </div>
    </div>
  );
}
