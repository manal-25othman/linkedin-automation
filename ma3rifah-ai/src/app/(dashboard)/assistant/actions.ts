'use server';

import { revalidatePath } from 'next/cache';
import { askAssistant, submitFeedback, type AnswerSource } from '@/lib/ai/chat-service';
import { requireCompanySession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { askSchema, firstIssueMessage } from '@/lib/validation/schemas';
import { toAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export interface AskResponse {
  ok: boolean;
  message?: string;
  data?: {
    conversationId: string;
    conversationTitle: string;
    assistantMessageId: string;
    answer: string;
    sources: AnswerSource[];
    isUnanswered: boolean;
    confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  };
}

export async function askAction(input: {
  question: string;
  conversationId: string | null;
}): Promise<AskResponse> {
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: firstIssueMessage(parsed.error) };
  }

  try {
    const result = await askAssistant({
      question: parsed.data.question,
      conversationId: parsed.data.conversationId ?? null,
    });

    revalidatePath('/conversations');
    revalidatePath('/dashboard');

    return {
      ok: true,
      data: {
        conversationId: result.conversationId,
        conversationTitle: result.conversationTitle,
        assistantMessageId: result.assistantMessageId,
        answer: result.answer,
        sources: result.sources,
        isUnanswered: result.isUnanswered,
        confidenceLevel: result.confidenceLevel,
      },
    };
  } catch (error) {
    const appError = toAppError(error);
    if (appError.code === 'INTERNAL') {
      logger.error('فشل غير متوقع في المساعد', { detail: appError.detail });
    }
    return { ok: false, message: appError.message };
  }
}

export async function feedbackAction(
  messageId: string,
  feedback: 'UP' | 'DOWN' | null,
  note?: string | null,
): Promise<{ ok: boolean; message?: string }> {
  try {
    await submitFeedback(messageId, feedback, note);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

export async function deleteConversationAction(
  conversationId: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    await requireCompanySession();
    const supabase = await createClient();

    const { error } = await supabase.from('conversations').delete().eq('id', conversationId);
    if (error) throw error;

    revalidatePath('/assistant');
    revalidatePath('/conversations');
    return { ok: true };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

export async function renameConversationAction(
  conversationId: string,
  title: string,
): Promise<{ ok: boolean; message?: string }> {
  const trimmed = title.trim();
  if (trimmed.length < 1 || trimmed.length > 120) {
    return { ok: false, message: 'العنوان يجب أن يكون بين حرف و120 حرفًا.' };
  }

  try {
    await requireCompanySession();
    const supabase = await createClient();

    const { error } = await supabase
      .from('conversations')
      .update({ title: trimmed })
      .eq('id', conversationId);
    if (error) throw error;

    revalidatePath('/assistant');
    revalidatePath('/conversations');
    return { ok: true };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}
