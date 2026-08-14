import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyUsers } from '@/lib/notifications';
import { logger } from '@/lib/logger';
import { truncate } from '@/lib/utils';

/**
 * الدعم الفني.
 *
 * الكتابة تمرّ بجلسة المستخدم لا بمفتاح الخدمة: RLS هي التي تمنع عميلًا
 * من الكتابة في تذكرة شركة أخرى، ومن وسم رسالته بأنها «من المنصة».
 * ومفتاح الخدمة لا يُستعمل إلا للتنبيهات — لأن المرسِل غير المستلم.
 */

/** تنبيه مالك المنصة بتذكرة جديدة أو ردّ جديد من عميل */
export async function notifyPlatformOwners(params: {
  ticketId: string;
  companyName: string;
  subject: string;
  isNew: boolean;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: owners } = await admin
      .from('profiles')
      .select('id, company_id')
      .eq('role', 'SUPER_ADMIN')
      .eq('status', 'ACTIVE');

    if (!owners?.length) return;

    // تنبيه مالك المنصة يحمل company_id الخاص به إن وُجد، وإلا فشركة
    // التذكرة — الجدول يشترط شركة، والقراءة مقصورة على المستلم نفسه.
    for (const owner of owners) {
      if (!owner.company_id) continue;
      await notifyUsers({
        companyId: owner.company_id,
        userIds: [owner.id],
        type: 'GAP_OPENED',
        title: params.isNew
          ? `تذكرة دعم جديدة — ${truncate(params.companyName, 40)}`
          : `ردّ جديد على تذكرة — ${truncate(params.companyName, 40)}`,
        body: params.subject,
        link: `/admin/support/${params.ticketId}`,
        entityType: 'support_ticket',
        entityId: params.ticketId,
      });
    }
  } catch (error) {
    logger.warn('تعذّر تنبيه مالك المنصة', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

/** تنبيه صاحب التذكرة بردّ المنصة */
export async function notifyTicketOwner(params: {
  ticketId: string;
  companyId: string;
  userId: string | null;
  subject: string;
}): Promise<void> {
  if (!params.userId) return;

  await notifyUsers({
    companyId: params.companyId,
    userIds: [params.userId],
    type: 'GAP_ANSWERED',
    title: 'ردّ على تذكرة الدعم',
    body: params.subject,
    link: `/support/${params.ticketId}`,
    entityType: 'support_ticket',
    entityId: params.ticketId,
  });
}

export async function getSupabase() {
  return createClient();
}
