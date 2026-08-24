import "server-only";

import { createHash } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * طبقة تجريد لمزوّد التضمينات (Embeddings).
 *
 * لماذا طبقة منفصلة: Claude API لا يوفّر endpoint للتضمينات، وهي
 * ركن أساسي في RAG. بدل ربط المنتج بمزوّد واحد، نعرّف واجهة واحدة
 * ونضع خلفها عدة تطبيقات. تبديل المزوّد لاحقًا = تغيير متغيّر بيئة
 * وإعادة توليد التضمينات، دون لمس أي كود آخر.
 *
 * المزوّدون:
 *   voyage — موصى به للإنتاج، جودة عالية مع العربية.
 *   openai — أي خدمة متوافقة مع OpenAI Embeddings API.
 *   local  — احتياطي حتمي للتطوير والعرض بلا مفاتيح خارجية.
 */

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dimensions: number;
  /** true إذا كان مزوّدًا حقيقيًا صالحًا للإنتاج */
  readonly isProduction: boolean;
  embed(texts: string[], kind: "document" | "query"): Promise<number[][]>;
}

const MAX_BATCH_SIZE = 64;
const REQUEST_TIMEOUT_MS = 30_000;

function l2Normalize(vector: number[]): number[] {
  let sumOfSquares = 0;
  for (const value of vector) sumOfSquares += value * value;
  const norm = Math.sqrt(sumOfSquares);
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * إعادة المحاولة عند تجاوز الحدّ أو عطل مؤقّت.
 *
 * الحساب الجديد لدى مزوّد التضمين يبدأ بحدّ منخفض جدًّا — ثلاثة طلبات في
 * الدقيقة قبل إضافة وسيلة الدفع. ومستندٌ من عشرين صفحة يُقطَّع إلى عدّة
 * دفعات، فيصطدم بالحدّ من الدفعة الثانية ويسقط المستند كلّه.
 *
 * وكان السقوط فوريًّا بلا محاولة واحدة. والانتظار ثوانيَ معدودة يُنجح
 * المستند بدل أن يُطلَب من المستخدم رفعه مرارًا — وهو ما كان سيفعله،
 * فيستهلك الحدّ نفسه في كل مرة ويفشل ثانيةً.
 *
 * ويُحترم `Retry-After` حين يرسله المزوّد لأنه أدقّ من أي تخمين، ويُقصّ
 * إلى خمس وعشرين ثانية: الدالّة تعمل في بيئة لها سقف زمني، وانتظارٌ
 * أطول يُسقط الطلب كلّه بدل أن ينقذه.
 */
const MAX_ATTEMPTS = 3;
const MAX_BACKOFF_MS = 25_000;

/** 429 تجاوز حدّ · 5xx عطل مؤقّت لدى المزوّد */
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function backoffMs(attempt: number, retryAfterHeader: string | null): number {
  const retryAfter = Number(retryAfterHeader);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, MAX_BACKOFF_MS);
  }
  // 5 ثوانٍ ثم 15 — يكفي حدَّ ثلاثة طلبات في الدقيقة لدفعتين
  return Math.min(5_000 * 3 ** attempt, MAX_BACKOFF_MS);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  provider: string,
): Promise<Response> {
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const response = await fetchWithTimeout(url, init);
    if (response.ok) return response;

    lastStatus = response.status;
    lastBody = await response.text();

    if (!isRetryable(response.status) || attempt === MAX_ATTEMPTS - 1) break;

    const wait = backoffMs(attempt, response.headers.get("retry-after"));
    logger.warn("تجاوز حدّ مزوّد التضمين — إعادة المحاولة", {
      provider,
      status: response.status,
      waitMs: wait,
      attempt: attempt + 1,
    });
    await sleep(wait);
  }

  throw new AppError(
    "EMBEDDINGS_UNAVAILABLE",
    lastStatus === 429
      ? "تجاوزت خدمة تحليل النصوص حدّها المسموح. إن كان الحساب جديدًا فقد يكون الحدّ منخفضًا حتى تُضاف وسيلة دفع لدى المزوّد. أعد المحاولة بعد دقيقة."
      : undefined,
    `${provider} ${lastStatus}: ${lastBody.slice(0, 300)}`,
  );
}

// ---------------------------------------------------------------- Voyage AI

class VoyageProvider implements EmbeddingProvider {
  readonly name = "voyage";
  readonly isProduction = true;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    readonly dimensions: number,
  ) {}

  async embed(
    texts: string[],
    kind: "document" | "query",
  ): Promise<number[][]> {
    const response = await fetchWithRetry(
      "https://api.voyageai.com/v1/embeddings",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: texts,
          model: this.model,
          input_type: kind,
          output_dimension: this.dimensions,
        }),
      },
      "Voyage",
    );

    const payload = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    return payload.data
      .sort((a, b) => a.index - b.index)
      .map((item) => l2Normalize(item.embedding));
  }
}

// -------------------------------------------------- OpenAI-compatible API

class OpenAiCompatibleProvider implements EmbeddingProvider {
  readonly name = "openai";
  readonly isProduction = true;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    readonly model: string,
    readonly dimensions: number,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/embeddings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: texts,
          model: this.model,
          dimensions: this.dimensions,
        }),
      },
      "OpenAI",
    );

    const payload = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    return payload.data
      .sort((a, b) => a.index - b.index)
      .map((item) => l2Normalize(item.embedding));
  }
}

// ------------------------------------------------------- Local (dev only)

/**
 * تضمين محلي حتمي: تجزئة الكلمات (hashing trick) مع وزن TF ثم تطبيع.
 *
 * ليس نموذجًا لغويًا — يلتقط التشابه المعجمي فقط (تطابق الكلمات
 * وجذورها التقريبية)، لذا يكفي لتشغيل العرض التجريبي والاختبارات
 * دون مفاتيح خارجية، لكنه لا يفهم الترادف ولا يصلح للإنتاج.
 */
class LocalProvider implements EmbeddingProvider {
  readonly name = "local";
  readonly model = "hashed-bow-v1";
  readonly isProduction = false;

  constructor(readonly dimensions: number) {}

  private static normalizeArabic(text: string): string {
    return text
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[ً-ْـ]/g, "")
      .toLowerCase();
  }

  private static tokenize(text: string): string[] {
    const normalized = LocalProvider.normalizeArabic(text);
    const words = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];

    const tokens: string[] = [];
    for (const word of words) {
      if (word.length < 2) continue;
      tokens.push(word);
      // جذوع تقريبية: تحسّن التطابق بين «الإجازات» و«إجازة»
      if (word.length > 4) tokens.push(word.slice(0, -1));
      if (word.length > 5) tokens.push(word.slice(0, -2));
      if (word.length > 3 && word.startsWith("ال")) tokens.push(word.slice(2));
    }

    // ثنائيات الكلمات لالتقاط بعض السياق
    for (let i = 0; i + 1 < words.length; i += 1) {
      tokens.push(`${words[i]}_${words[i + 1]}`);
    }

    return tokens;
  }

  private bucket(token: string): { index: number; sign: number } {
    const digest = createHash("sha256").update(token).digest();
    const index = digest.readUInt32BE(0) % this.dimensions;
    const sign = (digest[4] & 1) === 0 ? 1 : -1;
    return { index, sign };
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vector = new Array<number>(this.dimensions).fill(0);
      const tokens = LocalProvider.tokenize(text);

      const counts = new Map<string, number>();
      for (const token of tokens)
        counts.set(token, (counts.get(token) ?? 0) + 1);

      for (const [token, count] of counts) {
        const { index, sign } = this.bucket(token);
        // sublinear TF يقلّل أثر تكرار الكلمات الشائعة
        vector[index] += sign * (1 + Math.log(count));
      }

      return l2Normalize(vector);
    });
  }
}

// ------------------------------------------------------------- Factory

let cachedProvider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (cachedProvider) return cachedProvider;

  const dimensions = serverEnv.embeddingsDimensions;
  const configured = serverEnv.embeddingsProvider;

  if (configured === "voyage") {
    const key = serverEnv.voyageApiKey;
    if (key) {
      cachedProvider = new VoyageProvider(
        key,
        serverEnv.voyageModel,
        dimensions,
      );
      return cachedProvider;
    }
    logger.warn("VOYAGE_API_KEY مفقود — التحوّل إلى المزوّد المحلي.");
  }

  if (configured === "openai") {
    const key = serverEnv.openaiApiKey;
    if (key) {
      cachedProvider = new OpenAiCompatibleProvider(
        key,
        serverEnv.openaiBaseUrl,
        serverEnv.openaiEmbeddingsModel,
        dimensions,
      );
      return cachedProvider;
    }
    logger.warn("OPENAI_API_KEY مفقود — التحوّل إلى المزوّد المحلي.");
  }

  cachedProvider = new LocalProvider(dimensions);
  return cachedProvider;
}

/** لأغراض الاختبار فقط */
export function resetEmbeddingProvider(): void {
  cachedProvider = null;
}

/** تضمين مجموعة نصوص على دفعات مع إعادة محاولة عند فشل الشبكة */
export async function embedTexts(
  texts: string[],
  kind: "document" | "query" = "document",
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const provider = getEmbeddingProvider();
  const results: number[][] = [];

  for (let offset = 0; offset < texts.length; offset += MAX_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + MAX_BATCH_SIZE);

    let lastError: unknown;
    let embedded: number[][] | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        embedded = await provider.embed(batch, kind);
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await new Promise((resolve) =>
            setTimeout(resolve, 2 ** attempt * 750),
          );
        }
      }
    }

    if (!embedded) {
      logger.error("فشل توليد التضمينات", {
        provider: provider.name,
        batchSize: batch.length,
        reason:
          lastError instanceof Error ? lastError.message : String(lastError),
      });
      throw lastError instanceof AppError
        ? lastError
        : new AppError("EMBEDDINGS_UNAVAILABLE");
    }

    results.push(...embedded);
  }

  return results;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text], "query");
  if (!vector) throw new AppError("EMBEDDINGS_UNAVAILABLE");
  return vector;
}

/** تنسيق pgvector النصي: '[0.1,0.2,...]' */
export function toPgVector(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
