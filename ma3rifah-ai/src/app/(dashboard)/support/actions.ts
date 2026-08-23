'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCompanySession, requireSuperAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { notifyPlatformOwners, notifyTicketOwner } from '@/lib/support';
import { firstIssueMessage } from '@/lib/validation/schemas';
import { AppError, toAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export interface ActionResult {
  ok: boolean;
  message?: string;
  ticketId?: string;
}

const createSchema = z.object({
  subject: z.string().trim().min(4).max(160),
  category: z.string().trim().max(60).optional().or(z.literal('')),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  body: z.string().trim().min(10).max(4000),
});

const replySchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(2).max(4000),
});

/** فتح تذكرة — متاح لأي مستخدم نشط، فالعطل قد يصيب موظفًا لا مديرًا */
export async function createTicketAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requireCompanySession();
    await enforceRateLimit(`ticket:${profile.id}`, RATE_LIMITS.mutation);

    const parsed = createSchema.safeParse({
      subject: formData.get('subject'),
      category: formData.get('category'),
      priority: formData.get('priority') ?? 'NORMAL',
      body: formData.get('body'),
    });

    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const input = parsed.data;
    const supabase = await createClient();

    // company_id و created_by يُثبَّتان من الجلسة لا من النموذج، وتتحقق
    // منهما سياسة الإدراج مرة أخرى في قاعدة البيانات.
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        company_id: company.id,
        created_by: profile.id,
        subject: input.subject,
        category: input.category || null,
        priority: input.priority,
      })
      .select('id')
      .single();

    if (error || !ticket) {
      logger.error('تعذّر إنشاء تذكرة الدعم', { reason: error?.message });
      throw new AppError('INTERNAL', 'تعذّر فتح التذكرة.');
    }

    const { error: messageError } = await supabase.from('support_messages').insert({
      ticket_id: ticket.id,
      company_id: company.id,
      author_id: profile.id,
      from_platform: false,
      body: input.body,
    });

    if (messageError) {
      logger.error('تعذّر حفظ رسالة التذكرة', { reason: messageError.message });
      throw new AppError('INTERNAL', 'تعذّر حفظ نص المشكلة.');
    }

    await notifyPlatformOwners({
      ticketId: ticket.id,
      companyName: company.name,
      subject: input.subject,
      isNew: true,
    });

    revalidatePath('/support');
    return { ok: true, ticketId: ticket.id, message: 'فُتحت التذكرة. سنردّ عليك قريبًا.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/** ردّ العميل على تذكرته */
export async function replyToTicketAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requireCompanySession();
    await enforceRateLimit(`ticket-reply:${profile.id}`, RATE_LIMITS.mutation);

    const parsed = replySchema.safeParse({
      ticketId: formData.get('ticketId'),
      body: formData.get('body'),
    });
    if (!parsed.success) throw new AppError('VALIDATION', firstIssueMessage(parsed.error));

    const supabase = await createClient();

    // تتكفّل RLS بمنع القراءة عبر الشركات؛ الغياب هنا يعني «ليست لك»
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('id, subject')
      .eq('id', parsed.data.ticketId)
      .maybeSingle();

    if (!ticket) throw new AppError('NOT_FOUND', 'التذكرة غير موجودة.');

    const { error } = await supabase.from('support_messages').insert({
      ticket_id: ticket.id,
      company_id: company.id,
      author_id: profile.id,
      from_platform: false,
      body: parsed.data.body,
    });

    if (error) throw new AppError('INTERNAL', 'تعذّر إرسال الردّ.');

    await notifyPlatformOwners({
      ticketId: ticket.id,
      companyName: company.name,
      subject: ticket.subject,
      isNew: false,
    });

    revalidatePath(`/support/${ticket.id}`);
    return { ok: true, message: 'أُرسل ردّك.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/** ردّ مالك المنصة — يُوسَم «من المنصة» وتفرض السياسة أنه مالك فعلًا */
export async function platformReplyAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requireSuperAdmin();

    const parsed = replySchema.safeParse({
      ticketId: formData.get('ticketId'),
      body: formData.get('body'),
    });
    if (!parsed.success) throw new AppError('VALIDATION', firstIssueMessage(parsed.error));

    const admin = createAdminClient();
    const { data: ticket } = await admin
      .from('support_tickets')
      .select('id, company_id, created_by, subject')
      .eq('id', parsed.data.ticketId)
      .maybeSingle();

    if (!ticket) throw new AppError('NOT_FOUND', 'التذكرة غير موجودة.');

    const supabase = await createClient();
    const { error } = await supabase.from('support_messages').insert({
      ticket_id: ticket.id,
      company_id: ticket.company_id,
      author_id: profile.id,
      from_platform: true,
      body: parsed.data.body,
    });

    if (error) {
      logger.error('تعذّر ردّ المنصة', { reason: error.message });
      throw new AppError('INTERNAL', 'تعذّر إرسال الردّ.');
    }

    await notifyTicketOwner({
      ticketId: ticket.id,
      companyId: ticket.company_id,
      userId: ticket.created_by,
      subject: ticket.subject,
    });

    revalidatePath(`/admin/support/${ticket.id}`);
    revalidatePath('/admin/support');
    return { ok: true, message: 'أُرسل الردّ.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/** تغيير حالة التذكرة — لمالك المنصة وحده */
export async function updateTicketStatusAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireSuperAdmin();

    const parsed = z
      .object({
        ticketId: z.string().uuid(),
        status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
      })
      .safeParse({
        ticketId: formData.get('ticketId'),
        status: formData.get('status'),
      });

    if (!parsed.success) throw new AppError('VALIDATION', firstIssueMessage(parsed.error));

    const supabase = await createClient();
    const isDone = parsed.data.status === 'RESOLVED' || parsed.data.status === 'CLOSED';

    const { error } = await supabase
      .from('support_tickets')
      .update({
        status: parsed.data.status,
        resolved_at: isDone ? new Date().toISOString() : null,
      })
      .eq('id', parsed.data.ticketId);

    if (error) throw new AppError('INTERNAL', 'تعذّر تحديث الحالة.');

    revalidatePath('/admin/support');
    revalidatePath(`/admin/support/${parsed.data.ticketId}`);
    return { ok: true, message: 'حُدِّثت الحالة.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}
