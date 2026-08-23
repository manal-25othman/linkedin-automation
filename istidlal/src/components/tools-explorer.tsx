"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  hostingLabels,
  licenseLabels,
  toolCategories,
  type ToolHosting,
  type ToolLicense,
} from "@/config/tool-categories";

export type ToolCard = {
  slug: string;
  name: string;
  nameLatin: string;
  description: string;
  category: string;
  license: ToolLicense;
  hosting: ToolHosting;
  hasTiktok: boolean;
};

const ALL = "all";

/** يطابق العربية بعد تجريد التشكيل وتوحيد الألف والياء — بحث يتسامح مع الإملاء. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

export function ToolsExplorer({ tools }: { tools: ToolCard[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [license, setLicense] = useState<string>(ALL);

  const results = useMemo(() => {
    const needle = normalize(query.trim());
    return tools.filter((tool) => {
      if (category !== ALL && tool.category !== category) return false;
      if (license !== ALL && tool.license !== license) return false;
      if (!needle) return true;
      const haystack = normalize(`${tool.name} ${tool.nameLatin} ${tool.description}`);
      return haystack.includes(needle);
    });
  }, [tools, query, category, license]);

  return (
    <div className="mt-10">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <label className="sr-only" htmlFor="tools-search">
          ابحث في الأدوات
        </label>
        <input
          id="tools-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث باسم الأداة أو بما تفعله…"
          className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
        />

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
          <FilterRow label="التصنيف">
            <Chip active={category === ALL} onClick={() => setCategory(ALL)}>
              الكل
            </Chip>
            {toolCategories.map((item) => (
              <Chip
                key={item.slug}
                active={category === item.slug}
                onClick={() => setCategory(item.slug)}
              >
                {item.name}
              </Chip>
            ))}
          </FilterRow>

          <FilterRow label="الترخيص">
            <Chip active={license === ALL} onClick={() => setLicense(ALL)}>
              الكل
            </Chip>
            {(Object.keys(licenseLabels) as ToolLicense[]).map((key) => (
              <Chip key={key} active={license === key} onClick={() => setLicense(key)}>
                {licenseLabels[key]}
              </Chip>
            ))}
          </FilterRow>
        </div>
      </div>

      <p className="mt-6 text-sm text-ink-faint numerals-latn" role="status" aria-live="polite">
        {results.length} من {tools.length} أداة
      </p>

      {results.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
          <p className="text-ink">لا توجد أداة تطابق هذا البحث.</p>
          <p className="mt-2 text-sm text-ink-muted">
            جرّب كلمة أعمّ، أو أزل أحد المرشِّحات. الدليل مقصور على أدوات نستخدمها فعلًا في المقالات،
            فهو أضيق من قوائم «كل أدوات الذكاء الاصطناعي».
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-5 md:grid-cols-2">
          {results.map((tool) => (
            <li key={tool.slug}>
              <Link
                href={`/tools/${tool.slug}`}
                className="lift flex h-full flex-col rounded-2xl border border-line bg-surface p-6 hover:border-signal-line hover:shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-ink">{tool.name}</h2>
                    <p dir="ltr" className="mt-0.5 text-xs text-ink-faint">
                      {tool.nameLatin}
                    </p>
                  </div>
                  {tool.hasTiktok && (
                    <span className="shrink-0 rounded-md border border-signal-line bg-signal-soft px-2 py-1 text-[0.7rem] font-medium text-signal">
                      غطّيتها في تيك توك
                    </span>
                  )}
                </div>

                <p className="mt-3 flex-1 text-sm leading-7 text-ink-muted">{tool.description}</p>

                <div className="mt-5 flex flex-wrap gap-1.5">
                  <Tag>{licenseLabels[tool.license]}</Tag>
                  <Tag>{hostingLabels[tool.hosting]}</Tag>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-ink-faint">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-3 py-1.5 text-xs transition ${
        active
          ? "border-signal-line bg-signal-soft text-signal"
          : "border-line bg-bg text-ink-muted hover:border-signal-line hover:text-signal"
      }`}
    >
      {children}
    </button>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-surface-soft px-2 py-1 text-[0.7rem] text-ink-faint">
      {children}
    </span>
  );
}
