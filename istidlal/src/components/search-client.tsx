"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { categoryBySlug } from "@/config/categories";

export type SearchItem = {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
};

/** بحث في المتصفّح على فهرس مبنيّ وقت البناء — بلا خادم ولا خدمة خارجية. */
export function SearchClient({ index }: { index: SearchItem[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return index;
    return index.filter((item) =>
      [
        item.title,
        item.description,
        item.tags.join(" "),
        categoryBySlug.get(item.category)?.name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [index, query]);

  return (
    <div>
      <label className="sr-only" htmlFor="search-input">
        ابحث في المقالات
      </label>
      <input
        id="search-input"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="اكتب كلمة: تقطيع، تقييم، حقن التعليمات…"
        className="w-full rounded-2xl border border-line bg-surface px-5 py-4 text-base text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
      />

      <p className="mt-4 text-sm text-ink-faint numerals-latn">{results.length} نتيجة</p>

      <ul className="mt-6 flex flex-col gap-3">
        {results.map((item) => (
          <li key={item.slug}>
            <Link
              href={`/articles/${item.slug}`}
              className="block rounded-2xl border border-line bg-surface p-5 transition hover:border-signal-line"
            >
              <span className="text-xs text-signal">
                {categoryBySlug.get(item.category)?.short}
              </span>
              <h2 className="mt-1 font-display text-lg font-bold text-ink">{item.title}</h2>
              <p className="mt-1.5 line-clamp-2 text-sm leading-7 text-ink-muted">
                {item.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {results.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-muted">
          لا نتائج. جرّب كلمة أعمّ، أو تصفّح التصنيفات.
        </p>
      )}
    </div>
  );
}
