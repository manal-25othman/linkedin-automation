import type { Metadata } from "next";

import { ArchiveView } from "@/components/archive-view";
import { getArchivePage } from "@/lib/archive";

export const metadata: Metadata = {
  title: "كل المقالات",
  description:
    "أرشيف مقالات استدلال في هندسة أنظمة الذكاء الاصطناعي التطبيقية: الاسترجاع المعزّز، الوكلاء، التقييم، التكلفة، الأمن، والحوكمة.",
  alternates: { canonical: "/articles" },
};

export default function ArticlesPage() {
  const { articles, totalPages, counts, popular } = getArchivePage(1);

  return (
    <ArchiveView
      articles={articles}
      page={1}
      totalPages={totalPages}
      counts={counts}
      popular={popular}
    />
  );
}
