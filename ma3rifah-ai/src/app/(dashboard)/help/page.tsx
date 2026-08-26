import type { Metadata } from 'next';
import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { QuickStart } from '@/components/dashboard/quick-start';
import { HelpClient } from './help-client';

export const metadata: Metadata = { title: 'دليل الاستخدام' };

export default async function HelpPage() {
  // الدليل لكل من دخل — لا يحتاج شركة نشطة ولا صلاحية بعينها
  const session = await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader
        title="دليل الاستخدام"
        description="كل ما تحتاج معرفته لتشغيل قاعدة معرفة شركتك."
        actions={
          <Button variant="outline" asChild>
            <Link href="/support">
              <LifeBuoy className="size-4" aria-hidden />
              تواصل مع الدعم
            </Link>
          </Button>
        }
      />
      <QuickStart role={session.profile.role} />
      <HelpClient />
    </div>
  );
}
