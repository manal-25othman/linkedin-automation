/**
 * هل قاعدة البيانات المستهدفة خارج هذا الجهاز؟
 *
 * السكربتات الخطرة (البذور، بيانات العرض) تُشغَّل من جهاز المطوّر، وهناك
 * `NODE_ENV` ليس `production` مهما كانت القاعدة التي تشير إليها — فربط الحماية
 * به يترك قاعدة الإنتاج مكشوفة لأمر يُكتب بحسن نيّة من سطر الأوامر.
 * المعيار الصحيح هو أين تقع القاعدة، لا أين يعمل الأمر.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"]);

/**
 * الصيغة النقيّة. مفصولة عن قراءة البيئة عمدًا: لو كانت القيمة الافتراضية
 * للمعامل هي `process.env.DATABASE_URL` لعاد استدعاؤها بمتغيّر فارغ إلى قراءة
 * البيئة بدل الرفض الآمن — وهو آخر ما يريده حارس.
 */
export function isRemoteDatabaseUrl(url: string | undefined | null): boolean {
  if (!url) return true;

  try {
    const hostname = new URL(url).hostname.replace(/^\[|\]$/g, "");
    return !LOCAL_HOSTS.has(hostname);
  } catch {
    // رابط غير مفهوم: نفترض الأسوأ بدل أن نفتح الباب على قاعدة قد تكون حيّة.
    return true;
  }
}

/** القاعدة التي سيتّصل بها هذا الأمر فعلًا. */
export function isRemoteDatabase(): boolean {
  return isRemoteDatabaseUrl(process.env.DATABASE_URL);
}

/** كلمات مرور التطوير المنشورة في الوثائق — لا تصلح لحساب حيّ بأي حال. */
const PUBLISHED_DEV_PASSWORDS = new Set(["Anjez12345", "Partner12345"]);

export type PasswordCheck = { ok: true } | { ok: false; reason: string };

export function checkSeedPassword(password: string | undefined): PasswordCheck {
  const value = password?.trim() ?? "";

  if (!value) {
    return { ok: false, reason: "SEED_ADMIN_PASSWORD مطلوب عند البذر على قاعدة غير محلّية." };
  }
  if (PUBLISHED_DEV_PASSWORDS.has(value)) {
    return { ok: false, reason: "هذه كلمة مرور تطوير منشورة في الوثائق — اختر غيرها." };
  }
  if (value.length < 10) {
    return { ok: false, reason: "كلمة المرور يجب ألا تقل عن ١٠ أحرف." };
  }
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    return { ok: false, reason: "كلمة المرور يجب أن تجمع حرفًا ورقمًا." };
  }

  return { ok: true };
}
