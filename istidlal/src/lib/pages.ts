import "server-only";

import fs from "node:fs";
import path from "node:path";

import { parseFrontmatter } from "./frontmatter";
import { renderMarkdown } from "./markdown";

const PAGES_DIR = path.join(process.cwd(), "content", "pages");

export type PageDoc = {
  slug: string;
  title: string;
  description: string;
  lead?: string;
  updated?: string;
  html: string;
};

/** صفحة نصّية من `content/pages` — قابلة للتحرير من لوحة المحرّر. */
export async function getPage(slug: string): Promise<PageDoc> {
  const file = path.join(PAGES_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) {
    throw new Error(`صفحة غير موجودة: ${slug}`);
  }

  const { data, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  const { html } = await renderMarkdown(body);

  return {
    slug,
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    lead: data.lead ? String(data.lead) : undefined,
    updated: data.updated ? String(data.updated) : undefined,
    html,
  };
}

export function getPageSlugs(): string[] {
  if (!fs.existsSync(PAGES_DIR)) return [];
  return fs
    .readdirSync(PAGES_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""));
}
