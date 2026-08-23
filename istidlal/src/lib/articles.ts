import "server-only";

import fs from "node:fs";
import path from "node:path";

import { parseFrontmatter } from "./frontmatter";
import { extractFaq, readingMinutes, renderMarkdown, type Heading } from "./markdown";
import { categoryBySlug } from "@/config/categories";
import {
  isPubliclyVisible,
  resolveStatus,
  type PublicationStatus,
} from "./publication";

const CONTENT_DIR = path.join(process.cwd(), "content", "articles");

export type ArticleMeta = {
  slug: string;
  title: string;
  /** عنوان السيو إن اختلف عن عنوان الصفحة. */
  seoTitle?: string;
  description: string;
  category: string;
  tags: string[];
  published: string;
  updated?: string;
  featured: boolean;
  /** ثلاث نقاط تختصر المقال قبل قراءته. */
  takeaways: string[];
  readingMinutes: number;
  /** محسوبة من التاريخ وحقل `status`؛ لا تُكتب يدويًّا في القوائم. */
  status: PublicationStatus;
};

export type Article = ArticleMeta & {
  html: string;
  headings: Heading[];
  faq: { question: string; answer: string }[];
};

function readRawArticles() {
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

function toMeta(slug: string, data: Record<string, unknown>, body: string): ArticleMeta {
  const category = String(data.category ?? "");
  if (!categoryBySlug.has(category)) {
    throw new Error(`المقال «${slug}» يشير إلى تصنيف غير معرّف: «${category}»`);
  }
  const title = String(data.title ?? "");
  const description = String(data.description ?? "");
  if (!title || !description) {
    throw new Error(`المقال «${slug}» ينقصه العنوان أو الوصف.`);
  }

  return {
    slug,
    title,
    seoTitle: data.seoTitle ? String(data.seoTitle) : undefined,
    description,
    category,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    published: String(data.published ?? ""),
    updated: data.updated ? String(data.updated) : undefined,
    featured: data.featured === true,
    takeaways: Array.isArray(data.takeaways) ? (data.takeaways as string[]) : [],
    readingMinutes: readingMinutes(body),
    status: resolveStatus(String(data.published ?? ""), data.status ? String(data.status) : undefined),
  };
}

/**
 * كل ما في مجلد المحتوى — منشورًا كان أو مجدوَلًا أو مسوّدة.
 * للأدوات والفحوص فقط. لا تستدعِه من صفحة تُعرض للقارئ.
 */
export function getEveryArticle(): ArticleMeta[] {
  return readRawArticles()
    .map(({ slug, data, body }) => toMeta(slug, data, body))
    .sort((a, b) => (a.published < b.published ? 1 : -1));
}

/**
 * المقالات المنشورة فقط، من الأحدث إلى الأقدم.
 * هذه هي البوّابة الوحيدة لكل واجهة عامّة؛ المجدوَل والمسوّدة لا يمرّان منها.
 */
export function getAllArticles(): ArticleMeta[] {
  return getEveryArticle().filter((article) => isPubliclyVisible(article.status));
}

/** مسارات المقالات التي تُولَّد لها صفحات — المنشورة وحدها. */
export function getArticleSlugs(): string[] {
  return getAllArticles().map((article) => article.slug);
}

export async function getArticle(slug: string): Promise<Article | null> {
  const entry = readRawArticles().find((item) => item.slug === slug);
  if (!entry) return null;

  const meta = toMeta(entry.slug, entry.data, entry.body);
  // مقال لم يحن موعده لا يُعرض ولو طُلب مساره مباشرةً.
  if (!isPubliclyVisible(meta.status)) return null;

  const { html, headings } = await renderMarkdown(entry.body);

  return { ...meta, html, headings, faq: extractFaq(entry.body) };
}

/**
 * عدد المراجع المذكورة في قسم «المراجع» عبر كل المقالات المنشورة.
 * رقم محسوب من الملفات نفسها، لا رقم مكتوب باليد — إن نقص مرجع نقص العدّاد.
 */
export function getReferenceCount(): number {
  const published = new Set(getAllArticles().map((article) => article.slug));
  let total = 0;

  for (const entry of readRawArticles()) {
    if (!published.has(entry.slug)) continue;
    const section = entry.body.split(/^##\s+المراجع\s*$/m)[1];
    if (!section) continue;
    // نقف عند العنوان التالي حتى لا نعدّ روابط أقسام أخرى.
    const untilNextHeading = section.split(/^##\s/m)[0];
    total += (untilNextHeading.match(/\]\(https?:\/\//g) ?? []).length;
  }

  return total;
}

export function getArticlesByCategory(category: string): ArticleMeta[] {
  return getAllArticles().filter((article) => article.category === category);
}

export function getArticlesByTag(tag: string): ArticleMeta[] {
  return getAllArticles().filter((article) => article.tags.includes(tag));
}

export function getAllTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const article of getAllArticles()) {
    for (const tag of article.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ar"));
}

export function getFeaturedArticles(limit = 3): ArticleMeta[] {
  const all = getAllArticles();
  const featured = all.filter((article) => article.featured);
  return (featured.length ? featured : all).slice(0, limit);
}

/**
 * مقالات ذات صلة: نفس التصنيف أولًا، ثم اشتراك الوسوم — بلا تكرار المقال نفسه.
 */
export function getRelatedArticles(slug: string, limit = 3): ArticleMeta[] {
  const all = getAllArticles();
  const current = all.find((article) => article.slug === slug);
  if (!current) return all.slice(0, limit);

  const scored = all
    .filter((article) => article.slug !== slug)
    .map((article) => {
      const sameCategory = article.category === current.category ? 3 : 0;
      const sharedTags = article.tags.filter((tag) => current.tags.includes(tag)).length;
      return { article, score: sameCategory + sharedTags };
    })
    .sort((a, b) => b.score - a.score || (a.article.published < b.article.published ? 1 : -1));

  return scored.slice(0, limit).map((item) => item.article);
}

/** فهرس خفيف للبحث في المتصفّح — بلا خادم ولا خدمة خارجية. */
export function getSearchIndex() {
  return getAllArticles().map((article) => ({
    slug: article.slug,
    title: article.title,
    description: article.description,
    category: article.category,
    tags: article.tags,
  }));
}
