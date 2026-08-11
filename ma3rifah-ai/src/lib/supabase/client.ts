'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from './public-env';

/**
 * عميل Supabase للمتصفح.
 * يستخدم المفتاح العام (anon / publishable) فقط — وكل استعلام يمر عبر RLS.
 */
export function createClient() {
  return createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
}
