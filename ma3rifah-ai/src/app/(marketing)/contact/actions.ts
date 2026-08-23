'use server';

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { contactSchema, firstIssueMessage } from '@/lib/validation/schemas';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export interface ContactFormState {
  status: 'idle' | 'success' | 'error';
  message: string;
}

export async function submitContactRequest(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = contactSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    companyName: formData.get('companyName'),
    phone: formData.get('phone'),
    companySize: formData.get('companySize'),
    message: formData.get('message'),
  });

  if (!parsed.success) {
    return { status: 'error', message: firstIssueMessage(parsed.error) };
  }

  // حماية بسيطة ضد الإرسال الآلي: حقل مخفي يجب أن يبقى فارغًا
  if (String(formData.get('website') ?? '').length > 0) {
    return { status: 'success', message: 'تم استلام طلبك. سنتواصل معك قريبًا.' };
  }

  const headerList = await headers();
  const identifier =
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'contact-anonymous';

  const rate = await checkRateLimit(`contact:${identifier}`, RATE_LIMITS.mutation);
  if (!rate.allowed) {
    return {
      status: 'error',
      message: 'عدد كبير من المحاولات. يُرجى المحاولة بعد قليل.',
    };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from('contact_requests').insert({
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      company_name: parsed.data.companyName,
      phone: parsed.data.phone || null,
      company_size: parsed.data.companySize || null,
      message: parsed.data.message,
      source: 'website',
    });

    if (error) throw error;

    logger.info('طلب تواصل جديد', { companyName: parsed.data.companyName });

    return {
      status: 'success',
      message: 'تم استلام طلبك. سيتواصل معك فريقنا خلال يوم عمل.',
    };
  } catch (error) {
    logger.error('تعذّر حفظ طلب التواصل', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return {
      status: 'error',
      message: 'تعذّر إرسال الطلب حاليًا. حاول مرة أخرى أو راسلنا مباشرة على sales@ma3rifah.ai',
    };
  }
}
