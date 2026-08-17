import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type * as z from 'zod/v4';
import { serverEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AppError('AI_UNAVAILABLE', 'الوكيل غير مُهيّأ. يُرجى ضبط ANTHROPIC_API_KEY.');
  }
  if (!client) {
    client = new Anthropic({
      apiKey: serverEnv.anthropicApiKey,
      maxRetries: 2,
      // 10 دقائق: إعادة كتابة سيرة كاملة على تفكير عميق قد تطول
      timeout: 600_000,
    });
  }
  return client;
}

export interface StructuredResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/**
 * استدعاء واحد يُخرج بنية موثوقة.
 *
 * المخرجات المهيكلة (output_config.format) تُلزم النموذج بالمخطط على مستوى
 * الـ API، فلا حاجة لتعليمات «أخرج JSON فقط» ولا لمحاولات إصلاح نصّ تالف.
 * والبثّ ليس لعرض تدريجي — لا شيء يُعرض قبل اكتمال البنية — بل لأن الطلب
 * الطويل بلا بثّ يُقطع بمهلة HTTP قبل أن يُنهي النموذج إجابته.
 */
export async function generateStructured<S extends z.ZodType>(params: {
  systemPrompt: string;
  userMessage: string;
  schema: S;
  /** تجاوز سقف المخرجات الافتراضي */
  maxTokens?: number;
  /** وسم للسجلات — لا يحوي بيانات المستخدم */
  label: string;
}): Promise<StructuredResult<z.infer<S>>> {
  const anthropic = getClient();
  const model = serverEnv.anthropicModel;
  const startedAt = Date.now();
  const format = zodOutputFormat(params.schema);

  try {
    const stream = anthropic.messages.stream({
      model,
      max_tokens: params.maxTokens ?? serverEnv.anthropicMaxOutputTokens,
      system: [
        {
          type: 'text',
          text: params.systemPrompt,
          // التعليمة ثابتة عبر كل الطلبات، وهي أكبر جزء ثابت في الطلب
          cache_control: { type: 'ephemeral' },
        },
      ],
      output_config: {
        effort: serverEnv.anthropicEffort,
        format,
      },
      messages: [{ role: 'user', content: params.userMessage }],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
      throw new AppError(
        'AI_UNAVAILABLE',
        'تعذّر إنتاج نتيجة لهذا المحتوى. راجع نص الوظيفة أو السيرة وأعد المحاولة.',
        `refusal: ${message.stop_details?.category ?? 'unknown'}`,
      );
    }

    // بلوغ السقف يعني بنية مبتورة: JSON ناقص لا يُحلَّل. الفشل هنا صريح
    // أفضل من رسالة «تعذّر التحليل» غامضة بعد سطر واحد.
    if (message.stop_reason === 'max_tokens') {
      throw new AppError(
        'AI_UNAVAILABLE',
        'تجاوزت النتيجة الحد الأقصى لطولها فتوقفت قبل اكتمالها. جرّب سيرة أقصر أو ارفع ANTHROPIC_MAX_OUTPUT_TOKENS.',
        `max_tokens at ${message.usage.output_tokens}`,
      );
    }

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    if (!text) {
      throw new AppError('AI_UNAVAILABLE', undefined, 'empty response body');
    }

    const data = format.parse(text) as z.infer<S>;

    const latencyMs = Date.now() - startedAt;
    logger.info('اكتمل استدعاء النموذج', {
      label: params.label,
      model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      latencyMs,
    });

    return {
      data,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      latencyMs,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;

    logger.error('فشل استدعاء النموذج', {
      label: params.label,
      model,
      reason: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Anthropic.RateLimitError) {
      throw new AppError('AI_UNAVAILABLE', 'الخدمة مزدحمة حاليًا. حاول بعد لحظات.');
    }
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AppError('AI_UNAVAILABLE', 'إعدادات الوكيل غير صحيحة. راجع مفتاح Anthropic.');
    }
    throw new AppError('AI_UNAVAILABLE');
  }
}
