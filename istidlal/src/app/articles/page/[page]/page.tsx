import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArchiveView, PAGE_SIZE } from "@/components/archive-view";
import { getAllArticles } from "@/lib/articles";
import { getArchivePage } from "@/lib/archive";

type PageProps = { params: Promise<{ page: string }> };

function totalPages(): number {
  const rest = Math.max(0, getAllArticles().length - (PAGE_SIZE + 1));
  return 1 + Math.ceil(rest / PAGE_SIZE);
}

export function generateStaticParams() {
  // الصفحة الأولى تُخدَم من /articles، فتبدأ الصفحات المرقّمة من الثانية.
  return Array.from({ length: totalPages() - 1 }, (_, index) => ({ page: String(index + 2) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  return {
    title: `المقالات — صفحة ${page}`,
    description: `الصفحة ${page} من أرشيف مقالات استدلال في هندسة أنظمة الذكاء الاصطناعي التطبيقية.`,
    alternates: { canonical: `/articles/page/${page}` },
    // صفحات الأرشيف بعد الأولى محتواها مكرّر الطابع: تُتبَع ولا تُفهرَس.
    robots: { index: false, follow: true },
  };
}

export default async function ArchivePagedPage({ params }: PageProps) {
  const { page } = await params;
  const pageNumber = Number(page);

  if (!Number.isInteger(pageNumber) || pageNumber < 2 || pageNumber > totalPages()) notFound();

  const { articles, totalPages: pages, counts, popular } = getArchivePage(pageNumber);

  return (
    <ArchiveView
      articles={articles}
      page={pageNumber}
      totalPages={pages}
      counts={counts}
      popular={popular}
    />
  );
}
