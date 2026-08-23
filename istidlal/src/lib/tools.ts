import "server-only";

import fs from "node:fs";
import path from "node:path";

import { parseFrontmatter } from "./frontmatter";
import { renderMarkdown } from "./markdown";
import { isPubliclyVisible, resolveStatus, type PublicationStatus } from "./publication";
import {
  hostingLabels,
  licenseLabels,
  toolCategoryBySlug,
  type ToolHosting,
  type ToolLicense,
} from "@/config/tool-categories";

const CONTENT_DIR = path.join(process.cwd(), "content", "tools");

export type ToolMeta = {
  slug: string;
  name: string;
  /** الاسم كما يُكتب في موقع الأداة — لا نترجم أسماء المنتجات. */
  nameLatin: string;
  description: string;
  category: string;
  license: ToolLicense;
  hosting: ToolHosting;
  /** الموقع الرسمي للأداة. لا يُدرَج مدخل بلا رابط رسمي. */
  website: string;
  docs?: string;
  repo?: string;
  /**
   * رابط المقطع الذي غطّى الأداة على تيك توك — اختياري تمامًا.
   * لا يظهر شارة «غطّيتها في تيك توك» إلا إذا وُجد رابط فعلي.
   */
  tiktok?: string;
  /** الحالات التي تناسبها الأداة، والحالات التي لا تناسبها. */
  goodFor: string[];
  limits: string[];
  /** مقالات الموقع المرتبطة — ربط داخلي محسوب لا مكتوب في كل صفحة. */
  relatedArticles: string[];
  published: string;
  updated?: string;
  status: PublicationStatus;
};

export type Tool = ToolMeta & { html: string };

function readRawTools() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(CONTENT_DIR, file), "utf8");
      const { data, body } = parseFrontmatter(raw);
      return { slug: file.replace(/\.md$/, ""), data, body };
    });
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]).map(String) : [];
}

function toMeta(slug: string, data: Record<string, unknown>): ToolMeta {
  const category = String(data.category ?? "");
  if (!toolCategoryBySlug.has(category)) {
    throw new Error(`الأداة «${slug}» تشير إلى تصنيف غير معرّف: «${category}»`);
  }

  const license = String(data.license ?? "") as ToolLicense;
  const hosting = String(data.hosting ?? "") as ToolHosting;
  if (!(license in licenseLabels)) throw new Error(`الأداة «${slug}»: ترخيص غير معروف.`);
  if (!(hosting in hostingLabels)) throw new Error(`الأداة «${slug}»: طريقة تشغيل غير معروفة.`);

  const website = String(data.website ?? "");
  if (!/^https:\/\//.test(website)) {
    throw new Error(`الأداة «${slug}» بلا رابط رسمي صالح — لا يُدرج مدخل بلا مصدر.`);
  }

  return {
    slug,
    name: String(data.name ?? ""),
    nameLatin: String(data.nameLatin ?? ""),
    description: String(data.description ?? ""),
    category,
    license,
    hosting,
    website,
    docs: data.docs ? String(data.docs) : undefined,
    repo: data.repo ? String(data.repo) : undefined,
    tiktok: data.tiktok ? String(data.tiktok) : undefined,
    goodFor: stringList(data.goodFor),
    limits: stringList(data.limits),
    relatedArticles: stringList(data.relatedArticles),
    published: String(data.published ?? ""),
    updated: data.updated ? String(data.updated) : undefined,
    status: resolveStatus(String(data.published ?? ""), data.status ? String(data.status) : undefined),
  };
}

/** كل المدخلات بما فيها المجدوَل — للفحوص فقط. */
export function getEveryTool(): ToolMeta[] {
  return readRawTools().map(({ slug, data }) => toMeta(slug, data));
}

/** الأدوات المنشورة، مرتّبة أبجديًّا بالعربية. */
export function getAllTools(): ToolMeta[] {
  return getEveryTool()
    .filter((tool) => isPubliclyVisible(tool.status))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export function getToolSlugs(): string[] {
  return getAllTools().map((tool) => tool.slug);
}

export async function getTool(slug: string): Promise<Tool | null> {
  const entry = readRawTools().find((item) => item.slug === slug);
  if (!entry) return null;

  const meta = toMeta(entry.slug, entry.data);
  if (!isPubliclyVisible(meta.status)) return null;

  const { html } = await renderMarkdown(entry.body);
  return { ...meta, html };
}

export function getToolsByCategory(category: string): ToolMeta[] {
  return getAllTools().filter((tool) => tool.category === category);
}

/** أدوات تشترك في التصنيف — بديل بشري عن «قد يعجبك أيضًا». */
export function getRelatedTools(slug: string, limit = 3): ToolMeta[] {
  const all = getAllTools();
  const current = all.find((tool) => tool.slug === slug);
  if (!current) return [];
  return all
    .filter((tool) => tool.slug !== slug && tool.category === current.category)
    .slice(0, limit);
}

/**
 * الأدوات التي أشارت إلى هذا المقال. الربط معرَّف في جهة واحدة (ملف الأداة)
 * ويُقرأ من الجهتين، فلا يفترق الرابطان.
 */
export function getToolsForArticle(articleSlug: string): ToolMeta[] {
  return getAllTools().filter((tool) => tool.relatedArticles.includes(articleSlug));
}

/** فهرس البحث والتصفية في المتصفّح. */
export function getToolIndex() {
  return getAllTools().map((tool) => ({
    slug: tool.slug,
    name: tool.name,
    nameLatin: tool.nameLatin,
    description: tool.description,
    category: tool.category,
    license: tool.license,
    hosting: tool.hosting,
    hasTiktok: Boolean(tool.tiktok),
  }));
}

export type ToolIndexEntry = ReturnType<typeof getToolIndex>[number];
