import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/shared/page-header';
import { SITE_TEXT, defaultSiteText } from '@/content/site-text';
import { ContentClient, type EditableText } from './content-client';

export const metadata: Metadata = { title: 'محتوى الموقع' };
export const dynamic = 'force-dynamic';

export default async function AdminContentPage() {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { data } = await admin.from('site_content').select('key, value');

  const overrides = new Map((data ?? []).map((row) => [row.key, row.value]));

  // النصّ الأصلي هو الأساس، والتجاوز يعلوه — نفس ترتيب القراءة على الموقع،
  // كي يرى المحرِّر في اللوحة ما يراه الزائر على الصفحة بلا فرق.
  const defaults = defaultSiteText();

  const texts: EditableText[] = Object.keys(SITE_TEXT).map((key) => ({
    key,
    current: overrides.get(key) ?? defaults[key] ?? '',
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="محتوى الموقع"
        description="نصوص الموقع التعريفي. ما تحفظه هنا يظهر للزوّار مباشرةً."
      />
      <ContentClient texts={texts} />
    </div>
  );
}
