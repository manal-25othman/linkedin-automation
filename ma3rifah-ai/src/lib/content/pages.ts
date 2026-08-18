import 'server-only';

import { hasPublicSupabaseConfig } from '@/lib/supabase/public-env';
import { logger } from '@/lib/logger';

/**
 * قراءة الصفحات التي يصنعها مالك المنصة.
 *
 * تُقرأ بعميل الجلسة لا بمفتاح الخدمة، فتحرسها سياسة القراءة في قاعدة
 * البيانات: المنشور وحده يخرج. ولو قُرئت بمفتاح الخدمة لَصار إظهار
 * مسوّدةٍ على الموقع خطأً بسطرٍ واحد منسيّ في الشيفرة.
 *
 * وكل تعذّر هنا يعود قائمةً فارغة أو `null`: صفحة مفقودة تُعطي 404،
 * وقائمة تنقّل فارغة تُعطي قائمةً كما كانت. أما رمي الخطأ فيُسقط تخطيط
 * الموقع كلّه لأجل رابطٍ إضافي.
 */

export interface SitePage {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  body: string;
  status: 'DRAFT' | 'PUBLISHED';
  showInNav: boolean;
  sortOrder: number;
  updatedAt: string;
}

interface PageRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  body: string;
  status: string;
  show_in_nav: boolean;
  sort_order: number;
  updated_at: string;
}

export function toSitePage(row: PageRow): SitePage {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    body: row.body,
    status: row.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
    showInNav: row.show_in_nav,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

const COLUMNS = 'id, slug, title, description, body, status, show_in_nav, sort_order, updated_at';

/** روابط القائمة العلوية — المنشور المعلَّم بالظهور وحده */
export async function listNavPages(): Promise<{ slug: string; title: string }[]> {
  if (!hasPublicSupabaseConfig) return [];

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('site_pages')
      .select('slug, title')
      .eq('status', 'PUBLISHED')
      .eq('show_in_nav', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(12);

    if (error) throw error;
    return data ?? [];
  } catch (error) {
    logger.warn('تعذّرت قراءة صفحات القائمة', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/** صفحة منشورة باسمها — `null` إن لم توجد أو كانت مسوّدة */
export async function getPublishedPage(slug: string): Promise<SitePage | null> {
  if (!hasPublicSupabaseConfig) return null;

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('site_pages')
      .select(COLUMNS)
      .eq('slug', slug)
      .eq('status', 'PUBLISHED')
      .maybeSingle();

    if (error) throw error;
    return data ? toSitePage(data as PageRow) : null;
  } catch (error) {
    logger.warn('تعذّرت قراءة صفحة', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** كل الصفحات المنشورة — لخريطة الموقع */
export async function listPublishedPages(): Promise<{ slug: string; updatedAt: string }[]> {
  if (!hasPublicSupabaseConfig) return [];

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('site_pages')
      .select('slug, updated_at')
      .eq('status', 'PUBLISHED')
      .limit(500);

    if (error) throw error;
    return (data ?? []).map((row) => ({ slug: row.slug, updatedAt: row.updated_at }));
  } catch (error) {
    logger.warn('تعذّرت قراءة الصفحات المنشورة', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
