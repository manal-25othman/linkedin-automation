'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, LifeBuoy, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { HELP_ARTICLES, helpByCategory, searchHelp } from '@/content/help';

/**
 * فهرس دليل الاستخدام.
 *
 * البحث في العميل لأن المقالات كلها في الحزمة أصلًا: ثلاثة عشر مقالًا
 * تُفحص في أقل من ملّي ثانية، ورحلةُ شبكة لأجلها ثمنٌ بلا مقابل — بل
 * أسوأ، لأنها تجعل الكتابة متقطّعة.
 *
 * ويُبنى بمكوّنات اللوحة نفسها: الدليل الذي يبدو موقعًا آخر يُشعِر
 * القارئ بأنه غادر المنتج، فيتردّد في العودة.
 */
export function HelpClient() {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => helpByCategory(), []);
  const results = useMemo(() => searchHelp(query), [query]);
  const searching = query.trim() !== '';

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          style={{ insetInlineStart: '0.75rem' }}
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحثي في الدليل — مثال: رفع مستند، صلاحيات، فجوة"
          className="ps-10"
          aria-label="بحث في دليل الاستخدام"
        />
      </div>

      {searching ? (
        results.length === 0 ? (
          <Card>
            <CardContent className="space-y-4 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                لا مقال يطابق «{query}».
              </p>
              <Button variant="outline" asChild>
                <Link href="/support">
                  <LifeBuoy className="size-4" aria-hidden />
                  اسألي الدعم مباشرة
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <section className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {results.length} من {HELP_ARTICLES.length} مقالًا
            </p>
            {results.map((article) => (
              <ArticleRow key={article.slug} slug={article.slug} title={article.title} summary={article.summary} />
            ))}
          </section>
        )
      ) : (
        groups.map((group) => (
          <section key={group.category} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{group.category}</h2>
            <div className="space-y-3">
              {group.articles.map((article) => (
                <ArticleRow
                  key={article.slug}
                  slug={article.slug}
                  title={article.title}
                  summary={article.summary}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function ArticleRow({
  slug,
  title,
  summary,
}: {
  slug: string;
  title: string;
  summary: string;
}) {
  return (
    <Link href={`/help/${slug}`} className="block">
      <Card className="transition-colors hover:border-primary/40 hover:bg-accent/40">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <h3 className="text-sm font-medium">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{summary}</p>
          </div>
          <ArrowLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </CardContent>
      </Card>
    </Link>
  );
}
