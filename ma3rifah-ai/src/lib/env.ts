import 'server-only';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from './supabase/public-env';

/**
 * قراءة متغيرات البيئة والتحقق منها في مكان واحد.
 * أي مفتاح سري يُقرأ هنا لا يصل إلى المتصفح إطلاقًا ('server-only').
 */

/**
 * أسماء بديلة مقبولة لكل إعداد.
 *
 * غيّرت Supabase تسمية مفاتيحها (anon ← publishable، service_role ←
 * secret)، والاسمان متداولان في لوحات النشر. قبول الاسمين يمنع تعطّل
 * النظام كاملًا بسبب اختلاف تسمية لا اختلاف قيمة.
 */
const ENV_ALIASES: Record<string, string[]> = {
  NEXT_PUBLIC_SUPABASE_URL: ['NEXT_PUBLIC_SUPABASE_URL'],
  NEXT_PUBLIC_SUPABASE_ANON_KEY: [
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  ],
  SUPABASE_SERVICE_ROLE_KEY: ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'],
};

function readAny(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim() !== '') return value.trim();
  }
  return '';
}

function requiredAny(...names: string[]): string {
  const value = readAny(...names);
  if (value === '') {
    throw new Error(
      `متغير البيئة ${names[0]} غير مضبوط` +
        (names.length > 1 ? ` (ولا بديله ${names.slice(1).join(' / ')})` : '') +
        '. راجع ملف .env.example وانسخه إلى .env.local',
    );
  }
  return value;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `متغير البيئة ${name} غير مضبوط. راجع ملف .env.example وانسخه إلى .env.local`,
    );
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const serverEnv = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL');
  },
  get supabaseAnonKey() {
    if (PUBLIC_SUPABASE_ANON_KEY === '') {
      throw new Error(
        'متغير البيئة NEXT_PUBLIC_SUPABASE_ANON_KEY غير مضبوط ' +
          '(أو بديله NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY). راجع .env.example',
      );
    }
    return PUBLIC_SUPABASE_ANON_KEY;
  },
  get supabaseServiceRoleKey() {
    return requiredAny('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');
  },
  get anthropicApiKey() {
    return required('ANTHROPIC_API_KEY');
  },
  /**
   * النموذج الافتراضي.
   *
   * كان `claude-opus-5`، وهو أقوى النماذج وأغلاها: خمسة أضعاف سعر
   * الدخل وضعف سعر الخرج مقابل `claude-sonnet-5`. وبحساب الحصص
   * المعلنة كانت كل خطة تخسر عند الاستهلاك الكامل — أي أن العميل
   * الأكثر استعمالًا هو الأكثر خسارةً للمنصة، وهو انقلابٌ في نموذج
   * العمل لا مسألة تحسين.
   *
   * وsonnet-5 كافٍ لمهمة هذا المنتج: الإجابة مبنيّة على مقاطع
   * مسترجَعة ومقيَّدة بها، لا استنتاج مفتوح. والفرق بين النموذجين
   * يظهر في الاستدلال الطويل لا في «اقرأ هذه المقاطع وأجب منها».
   *
   * ومن أراد opus فليضبط `ANTHROPIC_MODEL` صراحةً — وليراجع الحصص.
   */
  get anthropicModel() {
    return optional('ANTHROPIC_MODEL', 'claude-sonnet-5');
  },
  /**
   * مستوى الجهد.
   *
   * الافتراضي `low` لا `medium`: التفكير الطويل يُحتسب رموزَ خرج بسعر
   * الخرج، وهو أغلى ما في الطلب. والسؤال هنا استرجاعيّ لا استدلاليّ،
   * فزيادة الجهد تزيد التكلفة أكثر مما تزيد الدقة.
   */
  get anthropicEffort() {
    const value = optional('ANTHROPIC_EFFORT', 'low');
    const allowed = ['low', 'medium', 'high', 'xhigh', 'max'];
    return allowed.includes(value) ? value : 'low';
  },
  get anthropicMaxOutputTokens() {
    // `max_tokens` سقف لمجموع (التفكير + نص الإجابة) لا للإجابة وحدها.
    // فالقيمة الضيقة جدًا (2000) قد يستهلكها التفكير فتُبتر الإجابة
    // العربية في منتصفها بلا خطأ — يعود stop_reason = 'max_tokens' فقط.
    //
    // و3000 مع جهد `low` تترك متسعًا لإجابة طويلة بعد التفكير، وتقطع
    // في الوقت نفسه الحالةَ التي كان فيها السقف 8000 بابًا لتكلفة
    // مفتوحة على سؤال واحد.
    return optionalInt('ANTHROPIC_MAX_OUTPUT_TOKENS', 3000);
  },
  get embeddingsProvider() {
    const value = optional('EMBEDDINGS_PROVIDER', 'local');
    return (['voyage', 'openai', 'local'].includes(value) ? value : 'local') as
      | 'voyage'
      | 'openai'
      | 'local';
  },
  get embeddingsDimensions() {
    return optionalInt('EMBEDDINGS_DIMENSIONS', 1024);
  },
  get voyageApiKey() {
    return optional('VOYAGE_API_KEY');
  },
  get voyageModel() {
    return optional('VOYAGE_MODEL', 'voyage-3.5');
  },
  get openaiApiKey() {
    return optional('OPENAI_API_KEY');
  },
  get openaiEmbeddingsModel() {
    return optional('OPENAI_EMBEDDINGS_MODEL', 'text-embedding-3-small');
  },
  get openaiBaseUrl() {
    return optional('OPENAI_BASE_URL', 'https://api.openai.com/v1');
  },
  get internalApiSecret() {
    return optional('INTERNAL_API_SECRET');
  },

  // ---------- بوابة الدفع (Moyasar) ----------
  // اختيارية: المنصة تعمل بلا دفع، ومسار الاشتراك وحده يتعطّل إن غابت.
  // إلزامها يمنع تشغيل المشروع محليًا أو نشره قبل فتح حساب البوابة.
  get moyasarSecretKey() {
    return optional('MOYASAR_SECRET_KEY');
  },
  /**
   * الرمز المشترك للتحقق من صحة نداء الـwebhook.
   *
   * غيابه لا يعني تعطيل التحقق بل رفض كل نداء: webhook بلا تحقق باب
   * مفتوح يستطيع أي أحد أن يطرق عليه «تم الدفع» فيُفعَّل اشتراك مجانًا.
   */
  get moyasarWebhookSecret() {
    return optional('MOYASAR_WEBHOOK_SECRET');
  },
  get isPaymentsConfigured() {
    return optional('MOYASAR_SECRET_KEY') !== '';
  },
  get appUrl() {
    return optional('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
  },
  get isProduction() {
    return process.env.NODE_ENV === 'production';
  },
};

/**
 * فحص أن الإعدادات الأساسية موجودة — يُستدعى من /api/health.
 */
export function checkConfiguration(): {
  ok: boolean;
  missing: string[];
  warnings: string[];
  detected: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  const detected: string[] = [];

  // الرابط والمفتاح العام يُقرآن من الثوابت المدمجة وقت البناء، لا من
  // process.env مباشرة: متغيرات NEXT_PUBLIC_ تُستبدل بقيمها في الحزمة،
  // والقراءة الديناميكية منها قد تُرجع فارغًا رغم ضبطها.
  if (PUBLIC_SUPABASE_URL === '') missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (PUBLIC_SUPABASE_ANON_KEY === '') {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY (أو NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)');
  }
  if (readAny(...ENV_ALIASES.SUPABASE_SERVICE_ROLE_KEY) === '') {
    missing.push('SUPABASE_SERVICE_ROLE_KEY (أو SUPABASE_SECRET_KEY)');
  }

  // تشخيص بلا أسرار: أسماء المتغيرات الموجودة وقت التشغيل فقط، بلا أي
  // قيمة ولا جزء منها. يكشف أخطاء التسمية التي تُعطّل النشر بصمت.
  for (const names of Object.values(ENV_ALIASES)) {
    for (const name of names) {
      if (process.env[name] && process.env[name]!.trim() !== '') detected.push(name);
    }
  }
  for (const name of ['ANTHROPIC_API_KEY', 'VOYAGE_API_KEY', 'NEXT_PUBLIC_APP_URL']) {
    if (process.env[name] && process.env[name]!.trim() !== '') detected.push(name);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    warnings.push('ANTHROPIC_API_KEY غير مضبوط — المساعد الذكي معطّل.');
  }

  const provider = process.env.EMBEDDINGS_PROVIDER || 'local';
  if (provider === 'voyage' && !process.env.VOYAGE_API_KEY) {
    warnings.push('EMBEDDINGS_PROVIDER=voyage لكن VOYAGE_API_KEY غير مضبوط.');
  }
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    warnings.push('EMBEDDINGS_PROVIDER=openai لكن OPENAI_API_KEY غير مضبوط.');
  }
  if (provider === 'local') {
    warnings.push(
      'مزوّد التضمينات المحلي مخصص للتطوير فقط؛ جودة الاسترجاع ستكون ضعيفة.',
    );
  }

  return { ok: missing.length === 0, missing, warnings, detected };
}
