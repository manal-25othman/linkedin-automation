import "server-only";

import { PAGE_SIZE } from "@/components/archive-view";
import { categories } from "@/config/categories";
import { getAllArticles, getArticlesByCategory, getFeaturedArticles } from "@/lib/articles";

/** كل ما تحتاجه صفحة الأرشيف لصفحة رقمها `page`. */
export function getArchivePage(page: number) {
  const all = getAllArticles();
  // الصفحة الأولى تحمل المتصدّر فوق الشبكة، فتأخذ عنصرًا إضافيًّا لتبقى
  // الشبكة مكتملة الصفوف بلا بطاقة يتيمة في آخر سطر.
  const firstPageSize = PAGE_SIZE + 1;
  const rest = Math.max(0, all.length - firstPageSize);
  const totalPages = 1 + Math.ceil(rest / PAGE_SIZE);

  const start = page === 1 ? 0 : firstPageSize + (page - 2) * PAGE_SIZE;
  const articles = all.slice(start, start + (page === 1 ? firstPageSize : PAGE_SIZE));

  const counts = Object.fromEntries(
    categories.map((category) => [category.slug, getArticlesByCategory(category.slug).length]),
  );

  return { articles, totalPages, counts, popular: getFeaturedArticles(3) };
}
