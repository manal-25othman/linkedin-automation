import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export type AuditAction =
  | 'auth.register'
  | 'auth.login'
  | 'auth.password_reset'
  | 'auth.logout_all'
  | 'company.updated'
  | 'company.ai_settings_updated'
  | 'plan.created'
  | 'plan.updated'
  | 'platform.expense.added'
  | 'platform.expense.ended'
  | 'invite.created'
  | 'invite.revoked'
  | 'site_content.updated'
  | 'site_page.created'
  | 'site_page.updated'
  | 'site_page.deleted'
  | 'subscription.checkout_started'
  | 'subscription.activated'
  | 'user.invited'
  | 'user.created'
  | 'user.updated'
  | 'user.role_changed'
  | 'user.deactivated'
  | 'user.reactivated'
  | 'user.access_link_resent'
  | 'department.created'
  | 'department.updated'
  | 'department.deleted'
  | 'category.created'
  | 'category.updated'
  | 'category.deleted'
  | 'whatsapp.link_code_requested'
  | 'whatsapp.unlinked'
  | 'document.uploaded'
  | 'document.upload_failed'
  | 'document.processed'
  | 'document.processing_failed'
  | 'document.updated'
  | 'document.deleted'
  | 'document.permissions_changed'
  | 'knowledge_gap.status_changed'
  | 'knowledge_gap.resolved'
  | 'knowledge_gap.draft_suggested'
  | 'assistant.question_asked'
  | 'assistant.answer_unanswered';

interface AuditInput {
  companyId: string | null;
  actorId: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * كتابة سجل تدقيق.
 *
 * لا يفشل الطلب الأصلي إذا تعذّرت الكتابة — يُسجَّل الخطأ فقط،
 * لأن فشل التدقيق لا ينبغي أن يمنع العملية التي نجحت أصلًا.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('audit_logs').insert({
      company_id: input.companyId,
      actor_id: input.actorId,
      actor_email: input.actorEmail ?? null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      metadata: (input.metadata ?? {}) as never,
    });
    if (error) throw error;
  } catch (error) {
    logger.warn('تعذّر كتابة سجل التدقيق', {
      action: input.action,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

/** حدث تحليلي — يغذّي لوحة التحليلات */
export async function recordAnalyticsEvent(input: {
  companyId: string;
  userId: string | null;
  departmentId?: string | null;
  eventType: string;
  entityType?: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from('analytics_events').insert({
      company_id: input.companyId,
      user_id: input.userId,
      department_id: input.departmentId ?? null,
      event_type: input.eventType,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      metadata: (input.metadata ?? {}) as never,
    });
  } catch (error) {
    logger.warn('تعذّر تسجيل الحدث التحليلي', {
      eventType: input.eventType,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
