import { categoryBySlug } from "@/config/categories";
import { getArticle, getArticleSlugs } from "@/lib/articles";
import { OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "مقال في استدلال";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug }));
}

export default async function ArticleOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);

  return renderOgImage({
    eyebrow: categoryBySlug.get(article?.category ?? "")?.name ?? "استدلال",
    title: article?.title ?? "استدلال",
  });
}
