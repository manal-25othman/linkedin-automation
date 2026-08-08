'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordAudit } from '@/lib/audit';
import { toAppError } from '@/lib/errors';

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export async function setCompanyStatusAction(
  companyId: string,
  status: 'ACTIVE' | 'SUSPENDED',
): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();
    const admin = createAdminClient();

    const { error } = await admin.from('companies').update({ status }).eq('id', companyId);
    if (error) throw error;

    await recordAudit({
      companyId,
      actorId: session.profile.id,
      actorEmail: session.profile.email,
      action: 'company.updated',
      entityType: 'company',
      entityId: companyId,
      metadata: { status },
    });

    revalidatePath('/admin/companies');
    revalidatePath('/admin');

    return {
      ok: true,
      message: status === 'ACTIVE' ? 'تم تفعيل الشركة.' : 'تم إيقاف الشركة.',
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}
