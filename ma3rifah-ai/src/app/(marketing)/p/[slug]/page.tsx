import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Section, PageHero } from '@/components/marketing/sections';
import { PageBody } from '@/components/marketing/page-body';
import { getPublishedPage } from '@/lib/content/pages';
import { firstParagraphText } from '@/lib/content/rich-text';

/**
 * الصفحات التي يصنعها مالك المنصة.
 *
 * تحت بادئة `/p/` كي لا يستطيع اسمُ صفحةٍ أن يحجب مسار تطبيق. ولا
 * `generateStaticParams` هنا: الصفحة تُنشأ وتُنشر من اللوحة في أي وقت،
 * فلا معنى لتثبيت قائمة المسارات وقت البناء.
 */

interface Params {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(decodeURIComponent(slug));
  if (!page) return { title: 'صفحة غير موجودة' };

  const description = page.description?.trim() || firstParagraphText(page.body);

  return {
    title: page.title,
    description: description || undefined,
    openGraph: { title: page.title, description: description || undefined },
  };
}

export default async function CustomPage({ params }: Params) {
  const { slug } = await params;
  const page = await getPublishedPage(decodeURIComponent(slug));

  // المسوّدة لا تُقرأ أصلًا بسياسة قاعدة البيانات، فتصل هنا `null`
  // وتُعطي 404 — لا شاشة «غير مصرّح» تُخبر الزائر أن الصفحة موجودة.
  if (!page) notFound();

  return (
    <>
      <PageHero title={page.title} description={page.description ?? undefined} />
      <Section>
        <article className="mx-auto max-w-3xl">
          <PageBody body={page.body} />
        </article>
      </Section>
    </>
  );
}
