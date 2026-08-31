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
  /** رموز قُرئت من التخزين المؤقت — تُسعَّر بعُشر سعر الدخل */
  cacheReadTokens: number;
  /** رموز كُتبت إلى التخزين المؤقت — تُسعَّر بضعف وربع */
  cacheWriteTokens: number;
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

/**
 * النماذج التي تدعم معامل output_config.effort.
 *
 * إرساله إلى نموذج لا يدعمه (مثل haiku-4-5) يُرجع 400 فيسقط الطلب كاملًا.
 * القائمة صريحة لا نمطية: النمط «كل ما ليس haiku» ينكسر مع أول نموذج جديد.
 */
const MODELS_WITH_EFFORT = [
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-opus-4-5',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
  'claude-fable-5',
  'claude-mythos-5',
];

export function supportsEffort(model: string): boolean {
  return MODELS_WITH_EFFORT.some((supported) => model.startsWith(supported));
}

/**
 * مُعامِلا التخزين المؤقت.
 *
 * القراءة من المخزَّن بعُشر سعر الدخل، والكتابة إليه بضعفٍ وربع. وهذا
 * ما يجعل التخزين المؤقت مجديًا: موجّه النظام ثابت عبر كل أسئلة الشركة،
 * فيُكتب مرة ويُقرأ مئات المرات.
 */
const CACHE_READ_MULTIPLIER = 0.1;
const CACHE_WRITE_MULTIPLIER = 1.25;

/**
 * تقدير تكلفة استدعاء.
 *
 * **`input_tokens` لا يشمل الرموز المخزَّنة مؤقتًا.** يفصلها المزوّد في
 * حقلين مستقلّين، فحسابُ الدخل وحده يُسقط تكلفة التخزين كلّها من
 * الحساب — وهو ما كان يحدث هنا.
 *
 * والخطأ في اتجاه واحد: **التكلفة تظهر أقلّ مما هي**، فيظهر الربح في
 * اللوحة المالية أعلى مما هو. وهذا أسوأ اتجاهي الخطأ، لأن الرقم
 * المتفائل لا يدفع أحدًا إلى مراجعته.
 */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheWriteTokens = 0,
): number {
  const pricing = MODEL_PRICING_USD_PER_MTOK[model] ?? { input: 5, output: 25 };

  const inputCost =
    inputTokens * pricing.input +
    cacheReadTokens * pricing.input * CACHE_READ_MULTIPLIER +
    cacheWriteTokens * pricing.input * CACHE_WRITE_MULTIPLIER;

  return (inputCost + outputTokens * pricing.output) / 1_000_000;
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
  /** تجاوز النموذج الافتراضي — لمهام أخف كمساعد الزوّار */
  model?: string;
  /** تجاوز سقف الرموز الافتراضي */
  maxTokens?: number;
}): Promise<CompletionResult> {
  const anthropic = getClient();
  const model = params.model || serverEnv.anthropicModel;
  const startedAt = Date.now();

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: params.maxTokens ?? serverEnv.anthropicMaxOutputTokens,
      system: [
        {
          type: 'text',
          text: params.systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      ...(supportsEffort(model)
        ? { output_config: { effort: serverEnv.anthropicEffort as 'low' | 'medium' | 'high' } }
        : {}),
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
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
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
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
        latencyMs: Date.now() - startedAt,
        stopReason: response.stop_reason,
      };
    }

    return {
      text,
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
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

/**
 * إعادة صياغة سؤالٍ فشل استرجاعه — الخطوة الوكيلة الأولى.
 *
 * السؤال يُكتب بالعامية أو بالاختصار («ابي ادارة المشاريع»)، والوثيقة
 * مكتوبة بلغة الأنظمة. حين لا يشترك اللفظان في معنًى قريب ولا في كلمة،
 * يعود الاسترجاع خاويًا ويقول المساعد «لم أجد» — والجواب في المستند.
 *
 * فتُعاد الصياغة بلغة الوثائق ويُبحث بها ثانيةً. ولا تُستدعى إلا بعد
 * فشل البحث الأول: النجاح لا يحتاجها، واستدعاؤها دائمًا يضيف زمنًا
 * وتكلفةً على كل سؤال لعلاج حالةٍ نادرة.
 *
 * النموذج الصغير يكفي — المهمة تحويل صياغة لا استدلال — والفشل فيها
 * ليس حرجًا: تعود null ويبقى جواب «لم أجد» كما كان.
 */
export async function rewriteSearchQuery(question: string): Promise<string | null> {
  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 100,
      system:
        'أنت تعيد صياغة أسئلة البحث في وثائق الشركات السعودية (لوائح، سياسات، إجراءات). ' +
        'أعد كتابة السؤال بالفصحى الرسمية بمفردات الأنظمة واللوائح، محافظًا على مقصده تمامًا. ' +
        'لا تُجب عن السؤال. أخرج الصياغة الجديدة وحدها في سطر واحد بلا مقدمات ولا علامات اقتباس.',
      messages: [{ role: 'user', content: question.slice(0, 500) }],
    });

    const rewritten = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join(' ')
      .trim()
      .replace(/^["'«»]|["'«»]$/g, '')
      .split('\n')[0]
      .trim();

    // صياغة مطابقة للأصل لا تفيد بحثًا ثانيًا، والفارغة ليست صياغة
    if (rewritten.length < 3 || rewritten === question.trim()) return null;
    return rewritten.slice(0, 300);
  } catch {
    // إعادة الصياغة تحسينٌ لا ركن — فشلُها يُرجعنا إلى السلوك القديم فقط
    return null;
  }
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
