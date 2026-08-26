import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/shared/page-header';
import { toSitePage, type SitePage } from '@/lib/content/pages';
import { PagesClient } from './pages-client';

export const metadata: Metadata = { title: 'صفحات الموقع' };
export const dynamic = 'force-dynamic';

export default async function AdminPagesPage() {
  await requireSuperAdmin();
  const admin = createAdminClient();

  // بمفتاح الخدمة كي تظهر المسوّدات: سياسة القراءة العامة تُخرج المنشور
  // وحده، وهو الصواب على الموقع — لكن اللوحة لا تصلح بلا مسوّداتها.
  const { data } = await admin
    .from('site_pages')
    .select(
      'id, slug, title, description, body, status, show_in_nav, sort_order, updated_at',
    )
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const pages: SitePage[] = (data ?? []).map((row) =>
    toSitePage(row as Parameters<typeof toSitePage>[0]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="صفحات الموقع"
        description="صفحات تصنعها بنفسك وتظهر على العنوان ‎/p/‎ — والمسوّدة لا يراها أحد حتى تُنشر."
      />
      <PagesClient pages={pages} />
    </div>
  );
}
