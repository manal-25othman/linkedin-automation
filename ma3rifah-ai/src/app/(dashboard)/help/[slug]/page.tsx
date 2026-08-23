import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, LifeBuoy } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageBody } from '@/components/marketing/page-body';
import { HELP_ARTICLES, findHelpArticle } from '@/content/help';

interface Params {
  params: Promise<{ slug: string }>;
}

/** المقالات معروفة وقت البناء — فتُبنى مسبقًا ولا تُنتظر */
export function generateStaticParams() {
  return HELP_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const article = findHelpArticle(slug);
  return { title: article ? article.title : 'دليل الاستخدام' };
}

export default async function HelpArticlePage({ params }: Params) {
  await requireSession();

  const { slug } = await params;
  const article = findHelpArticle(slug);
  if (!article) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/help"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" aria-hidden />
        دليل الاستخدام
      </Link>

      <div className="border-b pb-5">
        <p className="text-sm font-medium text-primary">{article.category}</p>
        <h1 className="mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl">
          {article.title}
        </h1>
      </div>

      <article className="max-w-3xl">
        <PageBody body={article.body} />
      </article>

      <Card className="max-w-3xl">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="text-sm text-muted-foreground">لم يجب هذا المقال عن سؤالك؟</p>
          <Button variant="outline" asChild>
            <Link href="/support">
              <LifeBuoy className="size-4" aria-hidden />
              افتحي تذكرة دعم
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
