import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/auth/rbac';
import { PageHeader } from '@/components/shared/page-header';
import { KnowledgeBaseClient, type CategoryCardData } from './knowledge-base-client';

export const metadata: Metadata = { title: 'قاعدة المعرفة' };
export const dynamic = 'force-dynamic';

export default async function KnowledgeBasePage() {
  const { profile } = await requirePermission('categories.view');
  const supabase = await createClient();

  const [categoriesResult, documentsResult] = await Promise.all([
    supabase
      .from('knowledge_categories')
      .select('id, name, description, color, sort_order')
      .order('sort_order', { ascending: true }),
    supabase.from('documents').select('category_id, status').neq('status', 'ARCHIVED'),
  ]);

  const documents = documentsResult.data ?? [];

  const totals = new Map<string, { total: number; ready: number }>();
  let uncategorizedCount = 0;

  for (const document of documents) {
    if (!document.category_id) {
      uncategorizedCount += 1;
      continue;
    }
    const entry = totals.get(document.category_id) ?? { total: 0, ready: 0 };
    entry.total += 1;
    if (document.status === 'READY') entry.ready += 1;
    totals.set(document.category_id, entry);
  }

  const categories: CategoryCardData[] = (categoriesResult.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    color: category.color,
    documentCount: totals.get(category.id)?.total ?? 0,
    readyCount: totals.get(category.id)?.ready ?? 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="قاعدة المعرفة"
        description="نظّم مستندات شركتك في تصنيفات واضحة تعكس هيكل معرفتها."
      />
      <KnowledgeBaseClient
        categories={categories}
        uncategorizedCount={uncategorizedCount}
        canManage={can(profile.role, 'categories.manage')}
      />
    </div>
  );
}
