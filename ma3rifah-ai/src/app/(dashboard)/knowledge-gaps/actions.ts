'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { knowledgeGapUpdateSchema, firstIssueMessage } from '@/lib/validation/schemas';
import { recordAudit } from '@/lib/audit';
import { AppError, toAppError } from '@/lib/errors';

export interface ActionResult {
  ok: boolean;
  message?: string;
}

const STATUS_MESSAGES: Record<string, string> = {
  OPEN: 'تم إعادة فتح الفجوة.',
  IN_REVIEW: 'تم نقل الفجوة إلى قيد المراجعة.',
  RESOLVED: 'تم وضع علامة معالَجة على الفجوة.',
  DISMISSED: 'تم تجاهل الفجوة.',
};

export async function updateKnowledgeGapAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('knowledge_gaps.manage');

    const parsed = knowledgeGapUpdateSchema.safeParse({
      gapId: formData.get('gapId'),
      status: formData.get('status'),
      resolutionNote: formData.get('resolutionNote'),
      linkedDocumentId: formData.get('linkedDocumentId') || null,
    });

    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const input = parsed.data;
    const isResolved = input.status === 'RESOLVED';

    if (isResolved && !input.resolutionNote && !input.linkedDocumentId) {
      throw new AppError(
        'VALIDATION',
        'عند وضع علامة معالَجة، اربط مستندًا أو اكتب ملاحظة توضّح كيف عولجت الفجوة.',
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('knowledge_gaps')
      .update({
        status: input.status,
        resolution_note: input.resolutionNote || null,
        linked_document_id: input.linkedDocumentId || null,
        resolved_by: isResolved ? profile.id : null,
        resolved_at: isResolved ? new Date().toISOString() : null,
      })
      .eq('id', input.gapId);

    if (error) throw error;

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: isResolved ? 'knowledge_gap.resolved' : 'knowledge_gap.status_changed',
      entityType: 'knowledge_gap',
      entityId: input.gapId,
      metadata: { status: input.status },
    });

    revalidatePath('/knowledge-gaps');
    revalidatePath('/dashboard');

    return { ok: true, message: STATUS_MESSAGES[input.status] ?? 'تم تحديث الفجوة.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}
