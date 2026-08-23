/**
 * محلّل ترويسة YAML مبسّط — يكفي حقول هذا المشروع بلا اعتماد خارجي.
 * المدعوم: `مفتاح: قيمة`، والقوائم بصيغة `[أ، ب]` أو أسطر تبدأ بـ`- `.
 */
export type Frontmatter = Record<string, string | string[] | boolean>;

const DELIMITER = "---";

export function parseFrontmatter(raw: string): { data: Frontmatter; body: string } {
  const text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith(`${DELIMITER}\n`)) return { data: {}, body: text };

  const end = text.indexOf(`\n${DELIMITER}`, DELIMITER.length);
  if (end === -1) return { data: {}, body: text };

  const head = text.slice(DELIMITER.length + 1, end);
  const body = text.slice(end + DELIMITER.length + 2).replace(/^\n+/, "");
  const data: Frontmatter = {};

  let currentListKey: string | null = null;

  for (const line of head.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    // عنصر قائمة تابع للمفتاح السابق.
    const listItem = /^\s*-\s+(.*)$/.exec(line);
    if (listItem && currentListKey) {
      (data[currentListKey] as string[]).push(unquote(listItem[1]));
      continue;
    }

    const pair = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!pair) continue;

    const [, key, rawValue] = pair;
    const value = rawValue.trim();

    if (value === "") {
      // مفتاح تتبعه قائمة في الأسطر التالية.
      data[key] = [];
      currentListKey = key;
      continue;
    }

    currentListKey = null;

    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => unquote(item.trim()))
        .filter(Boolean);
      continue;
    }

    if (value === "true" || value === "false") {
      data[key] = value === "true";
      continue;
    }

    data[key] = unquote(value);
  }

  return { data, body };
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
