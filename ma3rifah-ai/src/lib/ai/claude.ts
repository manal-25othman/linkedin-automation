import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { serverEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { TITLE_SYSTEM_PROMPT } from '@/lib/ai/prompts';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AppError(
      'AI_UNAVAILABLE',
      'المساعد الذكي غير مُهيّأ. يُرجى ضبط ANTHROPIC_API_KEY.',
    );
  }
  if (!client) {
    client = new Anthropic({
      apiKey: serverEnv.anthropicApiKey,
      maxRetries: 2,
      timeout: 120_000,
    });
  }
  return client;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompletionResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  stopReason: string | null;
}

/**
 * أسعار النموذج بالدولار لكل مليون رمز — لتقدير التكلفة فقط.
 * الفوترة الفعلية تأتي من مزوّد الخدمة.
 */
const MODEL_PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING_USD_PER_MTOK[model] ?? { input: 5, output: 25 };
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

/**
 * توليد إجابة المساعد.
 *
 * ضبط التكلفة هنا مقصود: نافذة تاريخ محدودة، سقف رموز إخراج،
 * ومستوى جهد قابل للضبط من متغيرات البيئة. التخزين المؤقت للموجّه
 * (prompt caching) مفعّل على موجّه النظام لأنه ثابت عبر كل أسئلة
 * الشركة الواحدة، وهو أكبر جزء ثابت في الطلب.
 */
export async function generateAnswer(params: {
  systemPrompt: string;
  history: ConversationTurn[];
  userMessage: string;
}): Promise<CompletionResult> {
  const anthropic = getClient();
  const model = serverEnv.anthropicModel;
  const startedAt = Date.now();

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: serverEnv.anthropicMaxOutputTokens,
      system: [
        {
          type: 'text',
          text: params.systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      output_config: { effort: serverEnv.anthropicEffort as 'low' | 'medium' | 'high' },
      messages: [
        ...params.history.map((turn) => ({
          role: turn.role,
          content: turn.content,
        })),
        { role: 'user' as const, content: params.userMessage },
      ],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (response.stop_reason === 'refusal') {
      return {
        text: 'تعذّر إنتاج إجابة لهذا السؤال. يُرجى إعادة صياغته أو التواصل مع الجهة المختصة في الشركة.',
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencyMs: Date.now() - startedAt,
        stopReason: response.stop_reason,
      };
    }

    // بلوغ السقف يعني أن الإجابة مبتورة. لا يرفع SDK خطأً هنا، فلو
    // أُعيد النص كما هو لظهر للموظف نصف جواب يبدو مكتملًا.
    if (response.stop_reason === 'max_tokens') {
      logger.warn('بلغت الإجابة سقف الرموز فبُترت', {
        model,
        outputTokens: response.usage.output_tokens,
      });

      return {
        text:
          (text ? `${text}\n\n` : '') +
          '⚠️ تجاوزت الإجابة الحد الأقصى لطولها فتوقفت قبل اكتمالها. ' +
          'أعد طرح السؤال بصيغة أضيق، أو اطلب من مدير الشركة رفع ' +
          'ANTHROPIC_MAX_OUTPUT_TOKENS.',
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencyMs: Date.now() - startedAt,
        stopReason: response.stop_reason,
      };
    }

    return {
      text,
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - startedAt,
      stopReason: response.stop_reason,
    };
  } catch (error) {
    logger.error('فشل استدعاء Claude API', {
      model,
      reason: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Anthropic.RateLimitError) {
      throw new AppError('RATE_LIMITED', 'الخدمة مزدحمة حاليًا. حاول بعد لحظات.');
    }
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AppError('AI_UNAVAILABLE', 'إعدادات المساعد الذكي غير صحيحة.');
    }
    throw new AppError('AI_UNAVAILABLE');
  }
}

/**
 * عنوان مختصر للمحادثة.
 * يستخدم نموذجًا أصغر وسقفًا منخفضًا لأنها مهمة بسيطة.
 */
export async function generateConversationTitle(question: string): Promise<string> {
  const fallback = question.trim().split(/\s+/).slice(0, 6).join(' ') || 'محادثة جديدة';

  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 40,
      system: TITLE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: question.slice(0, 500) }],
    });

    const title = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join(' ')
      .trim()
      .replace(/^["'«»]|["'«»]$/g, '');

    return title.length > 2 ? title.slice(0, 80) : fallback;
  } catch {
    // عنوان المحادثة ليس حرجًا — لا نُفشل الطلب بسببه
    return fallback.slice(0, 80);
  }
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
