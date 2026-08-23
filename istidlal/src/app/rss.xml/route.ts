import { absoluteUrl, siteConfig } from "@/config/site";
import { getAllArticles } from "@/lib/articles";

/** يُهرَّب النص قبل إدراجه في XML — عنوان فيه `&` يكسر التغذية. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET(): Response {
  const articles = getAllArticles();
  const updated = articles[0]?.updated ?? articles[0]?.published;

  const items = articles
    .map((article) => {
      const url = absoluteUrl(`/articles/${article.slug}`);
      return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(article.description)}</description>
      <pubDate>${new Date(`${article.published}T08:00:00Z`).toUTCString()}</pubDate>
      <category>${escapeXml(article.category)}</category>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteConfig.name)}</title>
    <link>${siteConfig.url}</link>
    <description>${escapeXml(siteConfig.description)}</description>
    <language>ar</language>
    <atom:link href="${absoluteUrl("/rss.xml")}" rel="self" type="application/rss+xml" />
    ${updated ? `<lastBuildDate>${new Date(`${updated}T08:00:00Z`).toUTCString()}</lastBuildDate>` : ""}
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
