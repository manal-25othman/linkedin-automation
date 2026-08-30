import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { FloatingDock } from '@/components/shared/floating-dock';
import { SiteChatWidget } from '@/components/marketing/site-chat-widget';
import { listNavPages } from '@/lib/content/pages';

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // الصفحات المصنوعة في اللوحة تدخل القائمة من هنا. والقراءة في التخطيط
  // لا في الترويسة لأن الترويسة مكوّن عميل — تحتاج حالة القائمة والمسار
  // الحالي — فلا تستطيع الاستعلام بنفسها.
  const navPages = await listNavPages();

  return (
    <div className="marketing-shell flex min-h-screen flex-col">
      <SiteHeader
        extraLinks={navPages.map((page) => ({
          href: `/p/${encodeURIComponent(page.slug)}`,
          label: page.title,
        }))}
      />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <FloatingDock>
        <SiteChatWidget />
      </FloatingDock>
    </div>
  );
}
