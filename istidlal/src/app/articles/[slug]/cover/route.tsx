import { categoryBySlug } from "@/config/categories";
import { getArticle, getArticleSlugs } from "@/lib/articles";
import { renderCoverImage } from "@/lib/og";

/** غلاف مولَّد لكل مقال — لا صور مخزَّنة ولا مصادر خارجية. */
export const dynamic = "force-static";

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return new Response("غير موجود", { status: 404 });

  const category = categoryBySlug.get(article.category);

  return renderCoverImage({
    eyebrow: category?.name ?? "استدلال",
    accent: category?.accent,
  });
}
