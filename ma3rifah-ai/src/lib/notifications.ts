import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { truncate } from '@/lib/utils';

/**
 * التنبيهات داخل المنصة.
 *
 * تُنشأ بمفتاح الخدمة لأن المرسِل غير المستلم: مدير الشركة يحلّ فجوة
 * فيصل التنبيه إلى الموظف الذي سألها. ولا يملك أي عميل سياسة كتابة على
 * الجدول، فالإنشاء محصور في هذا الملف.
 *
 * ولأن مفتاح الخدمة يتجاوز RLS، فمسؤولية حصر الشركة تقع على هذا الكود
 * وحده: كل دالة هنا تتطلب companyId صراحةً وتصفّي به المستلمين، ولا
 * تقبل قائمة مستلمين جاهزة من المُنادي.
 */

export type NotificationType =
  | 'GAP_ANSWERED'
  | 'GAP_OPENED'
  | 'DOCUMENT_FAILED'
  | 'DOCUMENT_READY'
  | 'QUOTA_WARNING'
  | 'LOW_CONFIDENCE';

export interface NotificationInput {
  companyId: string;
  userIds: string[];
  type: NotificationType;
  title: string;
  body?: string | null;
  /** مسار داخلي فقط — تمنع قاعدة البيانات أي رابط خارجي */
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

/**
 * إرسال تنبيه إلى مستخدمين بأعيانهم.
 *
 * لا يُفشل العملية الأصلية عند تعثّره: تنبيه ضائع أهون من فجوة لم
 * تُحلّ لأن إرسال التنبيه رمى خطأ.
 */
export async function notifyUsers(input: NotificationInput): Promise<number> {
  if (input.userIds.length === 0) return 0;

  try {
    const admin = createAdminClient();

    // حاجز أخير ضد الخلط بين الشركات: يُتحقق أن كل مستلم من الشركة
    // المذكورة فعلًا. مفتاح الخدمة لا يفرض ذلك، فنفرضه هنا صراحةً.
    const { data: recipients } = await admin
      .from('profiles')
      .select('id')
      .eq('company_id', input.companyId)
      .eq('status', 'ACTIVE')
      .in('id', input.userIds);

    const verified = (recipients ?? []).map((row) => row.id);
    if (verified.length === 0) return 0;

    const { error } = await admin.from('notifications').upsert(
      verified.map((userId) => ({
        company_id: input.companyId,
        user_id: userId,
        type: input.type,
        title: truncate(input.title, 160),
        body: input.body ? truncate(input.body, 500) : null,
        link: input.link ?? null,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
      })),
      { onConflict: 'user_id,type,entity_id', ignoreDuplicates: true },
    );

    if (error) {
      logger.warn('تعذّر إنشاء التنبيهات', { reason: error.message });
      return 0;
    }

    return verified.length;
  } catch (error) {
    logger.warn('تعذّر إنشاء التنبيهات', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * حذف تنبيهات حدث بطل مسوّغه.
 *
 * الفهرس الفريد على (المستخدم، النوع، الكيان) يمنع تكرار التنبيه عن
 * الحدث نفسه — وهو المطلوب. لكنه يعني أيضًا أن تنبيهًا سُحب سببه يسدّ
 * الطريق أمام تنبيه لاحق مستحقّ: لو حُذفت إجابةٌ ثم كُتبت أخرى، لَما
 * وصل صاحب السؤال شيء لأن الصفّ القديم ما زال قائمًا. فيُحذف القديم
 * ليبقى الفهرس حارسًا ضد التكرار لا ضد الإخبار.
 */
export async function clearEntityNotifications(params: {
  companyId: string;
  type: NotificationType;
  entityId: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from('notifications')
      .delete()
      .eq('company_id', params.companyId)
      .eq('type', params.type)
      .eq('entity_id', params.entityId);
  } catch (error) {
    logger.warn('تعذّر حذف التنبيهات', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

/** تنبيه كل من يملك صلاحية إدارية في الشركة */
export async function notifyCompanyAdmins(
  input: Omit<NotificationInput, 'userIds'>,
): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data: admins } = await admin
      .from('profiles')
      .select('id')
      .eq('company_id', input.companyId)
      .eq('status', 'ACTIVE')
      .in('role', ['COMPANY_ADMIN']);

    return await notifyUsers({ ...input, userIds: (admins ?? []).map((row) => row.id) });
  } catch (error) {
    logger.warn('تعذّر تنبيه مديري الشركة', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}
