import type { Metadata } from "next";

import { PageShell } from "./page-shell";
import { getPage } from "@/lib/pages";

/** يبني بيانات السيو من ترويسة ملف الصفحة نفسه. */
export async function buildPageMetadata(slug: string): Promise<Metadata> {
  const page = await getPage(slug);
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/${slug}` },
  };
}

/** يعرض صفحة نصّية كاملة من ملف Markdown، مع فتحة لإلحاق عناصر تفاعلية. */
export async function MarkdownPage({
  slug,
  children,
}: {
  slug: string;
  children?: React.ReactNode;
}) {
  const page = await getPage(slug);

  return (
    <PageShell
      title={page.title}
      lead={page.lead}
      updated={page.updated}
      crumbs={[{ href: `/${slug}`, label: page.title }]}
    >
      <div dangerouslySetInnerHTML={{ __html: page.html }} />
      {children}
    </PageShell>
  );
}
