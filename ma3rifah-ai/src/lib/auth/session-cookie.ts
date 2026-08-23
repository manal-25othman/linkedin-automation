import type { SessionStamp, SessionTier } from '@/lib/auth/session-policy';

/**
 * ختم الجلسة — كوكي موقَّع يحمل بداية الجلسة وآخر نشاط فيها.
 *
 * **لماذا كوكي لا جدول؟** لأن الفحص يقع في الـmiddleware، أي على كل طلب
 * لكل صفحة وكل ملف. واستعلام قاعدة بيانات في ذلك الموضع يضيف رحلة شبكة
 * إلى كل شيء — وهو ثمن لا يستحقه فحصٌ جوابه تاريخان.
 *
 * **ولماذا موقَّع؟** لأن الكوكي يصل من المتصفح، ومن يملك تحريره يملك
 * تمديد جلسته إلى الأبد بتغيير رقم. والتوقيع يجعل التزوير مكشوفًا:
 * قيمةٌ لا يطابق توقيعُها محتواها تُعامَل معاملة الجلسة المنتهية.
 *
 * ولا يحمل الختم سرًّا: هويةُ الرتبة وتاريخان. فلا ضرر من قراءته، وإنما
 * الضرر من كتابته — والتوقيع يمنعها وحدها.
 *
 * ويُكتب بـWeb Crypto لا بوحدة `crypto` في Node، لأن هذا الملف يعمل في
 * بيئة الحافة (edge) حيث الـmiddleware، وفيها لا وجود لوحدات Node.
 */

export const SESSION_COOKIE = 'm3_sess';

/** الحدّ الأدنى المقبول لطول السرّ */
const MIN_SECRET_LENGTH = 16;

let cachedKey: CryptoKey | null = null;
let cachedSecret = '';

/**
 * سرّ التوقيع.
 *
 * يُفضَّل `SESSION_SECRET` صريحًا. وإن غاب، يُشتقّ من مفتاح الخدمة —
 * وهو سرٌّ خادميّ عالي العشوائية موجود أصلًا في كل نشر يعمل. والاشتقاق
 * (لا الاستعمال المباشر) يمنع أن يكشف توقيعٌ شيئًا عن المفتاح الأصل.
 *
 * وغياب الاثنين معًا يعني نشرًا غير مكتمل، وعندها لا تُوقَّع الأختام
 * ولا تُقبل — فتنتهي كل جلسة عند أول طلب. وهو الاتجاه الآمن: تعطّل
 * ظاهر خيرٌ من حراسةٍ صامتة لا تحرس.
 */
function readSecret(): string {
  const explicit = process.env.SESSION_SECRET;
  if (explicit && explicit.trim().length >= MIN_SECRET_LENGTH) return explicit.trim();

  const derived =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? '';
  if (derived.trim().length >= MIN_SECRET_LENGTH) {
    return `ma3rifah.session.v1:${derived.trim()}`;
  }

  return '';
}

export function hasSessionSecret(): boolean {
  return readSecret() !== '';
}

async function getKey(): Promise<CryptoKey | null> {
  const secret = readSecret();
  if (secret === '') return null;

  if (cachedKey && cachedSecret === secret) return cachedKey;

  cachedKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  cachedSecret = secret;
  return cachedKey;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(payload: string): Promise<string | null> {
  const key = await getKey();
  if (!key) return null;
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  );
  return toBase64Url(new Uint8Array(signature));
}

/** مقارنة ثابتة الزمن — المقارنة العادية تسرّب طول التطابق */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** يبني قيمة الكوكي: `tier.startedAt.lastSeenAt.signature` */
export async function encodeStamp(stamp: SessionStamp): Promise<string | null> {
  const payload = `${stamp.tier}.${stamp.startedAt}.${stamp.lastSeenAt}`;
  const signature = await sign(payload);
  return signature === null ? null : `${payload}.${signature}`;
}

/** يقرأ الكوكي ويتحقق من توقيعه — `null` عند أي خلل */
export async function decodeStamp(value: string | undefined): Promise<SessionStamp | null> {
  if (!value) return null;

  const parts = value.split('.');
  if (parts.length !== 4) return null;

  const [tier, startedAt, lastSeenAt, signature] = parts;
  if (tier !== 'ADMIN' && tier !== 'STANDARD') return null;

  const expected = await sign(`${tier}.${startedAt}.${lastSeenAt}`);
  if (expected === null || !timingSafeEqual(expected, signature)) return null;

  const started = Number(startedAt);
  const seen = Number(lastSeenAt);
  if (!Number.isFinite(started) || !Number.isFinite(seen)) return null;

  return { tier: tier as SessionTier, startedAt: started, lastSeenAt: seen };
}

/**
 * خصائص الكوكي.
 *
 * `httpOnly` يمنع قراءته من JavaScript، فسرقةُ الختم تحتاج أكثر من ثغرة
 * نصّية عابرة. و`sameSite: lax` يمنع إرساله مع طلب من موقع آخر، وهو
 * حارس CSRF كافٍ لنموذج يعتمد الكوكي. و`secure` خارج التطوير المحلي.
 */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
