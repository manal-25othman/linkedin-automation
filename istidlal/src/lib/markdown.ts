import "server-only";

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";

export type Heading = { id: string; text: string; level: 2 | 3 };

/**
 * يمنح كل عنوان معرّفًا لاتينيًا قصيرًا (`s-1`) بدل تعريب الرابط،
 * ويجمع العناوين لبناء جدول المحتويات في المرور نفسه.
 */
function collectHeadings(headings: Heading[]) {
  return () => (tree: Root) => {
    let counter = 0;
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "h2" && node.tagName !== "h3") return;
      counter += 1;
      const id = `s-${counter}`;
      node.properties = { ...node.properties, id };
      headings.push({
        id,
        text: textOf(node),
        level: node.tagName === "h2" ? 2 : 3,
      });
    });
  };
}

/** الروابط الخارجية تُفتح في تبويب جديد وبلا تسريب مرجع. */
function hardenExternalLinks() {
  return () => (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return;
      const href = String(node.properties?.href ?? "");
      if (!/^https?:\/\//.test(href)) return;
      node.properties = {
        ...node.properties,
        target: "_blank",
        rel: ["noopener", "noreferrer"],
      };
    });
  };
}

/**
 * كتلة `\`\`\`rtl` مخطّط لا كود: نصّها عربي، فتُعرض باتجاه القراءة الصحيح
 * بدل اتجاه الكود من اليسار لليمين الذي يبعثر ترتيب الكلمات.
 */
function rtlDiagrams() {
  return () => (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return;
      const code = node.children.find(
        (child): child is Element => child.type === "element" && child.tagName === "code",
      );
      const classes = (code?.properties?.className as string[] | undefined) ?? [];
      if (!classes.includes("language-rtl")) return;

      code!.properties = { ...code!.properties, className: [] };
      node.properties = { ...node.properties, dir: "rtl", className: ["diagram"] };
    });
  };
}

function textOf(node: Element): string {
  let out = "";
  visit(node, "text", (child: { value: string }) => {
    out += child.value;
  });
  return out.trim();
}

export type RenderedMarkdown = { html: string; headings: Heading[] };

export async function renderMarkdown(source: string): Promise<RenderedMarkdown> {
  const headings: Heading[] = [];

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    // المحتوى من المستودع لا من مستخدم؛ ومع ذلك لا نسمح بـHTML خام.
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(collectHeadings(headings))
    .use(hardenExternalLinks())
    .use(rtlDiagrams())
    .use(rehypeStringify)
    .process(source);

  return { html: String(file), headings };
}

/**
 * يستخرج أزواج سؤال/جواب من قسم الأسئلة الشائعة لبناء بيانات FAQPage
 * المهيكلة. الاتفاق: `## الأسئلة الشائعة` ثم `### السؤال` وتحته الجواب.
 */
export function extractFaq(source: string): { question: string; answer: string }[] {
  const start = source.search(/^##\s+الأسئلة الشائعة\s*$/m);
  if (start === -1) return [];

  const rest = source.slice(start);
  const endMatch = /\n##\s+(?!#)/.exec(rest.slice(3));
  const section = endMatch ? rest.slice(0, endMatch.index + 3) : rest;

  const faq: { question: string; answer: string }[] = [];
  const blocks = section.split(/^###\s+/m).slice(1);

  for (const block of blocks) {
    const [questionLine, ...answerLines] = block.split("\n");
    const answer = answerLines
      .join(" ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_`>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (questionLine.trim() && answer) {
      faq.push({ question: questionLine.trim(), answer });
    }
  }

  return faq;
}

/** تقدير زمن القراءة بالعربية: ~١٨٠ كلمة في الدقيقة للنص التقني. */
export function readingMinutes(source: string): number {
  const words = source.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 180));
}
