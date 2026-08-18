import bcrypt from "bcryptjs";

/** تكلفة bcrypt — 12 جولة توازن بين المقاومة وزمن تسجيل الدخول. */
const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * hash صالح بنفس تكلفة الجولات المستخدمة في الحسابات الحقيقية.
 * يجب أن يكون صالحًا فعلًا: bcrypt يرفض الـ hash المشوّه فورًا دون عمل حسابي،
 * وهو ما يُفقد المقارنة الوهمية فائدتها.
 */
const TIMING_PLACEHOLDER_HASH =
  "$2b$12$PcimYfLEgviNYurERLCxKeIEXUy.DKWu/RJkXT0UOBnIT6LYunt52";

/**
 * تُنفَّذ عند عدم إيجاد المستخدم حتى يستغرق الرد نفس الزمن تقريبًا،
 * فلا يكشف الفرق الزمني عن وجود البريد من عدمه.
 */
export async function dummyPasswordCompare(): Promise<void> {
  await bcrypt.compare("invalid-password-placeholder", TIMING_PLACEHOLDER_HASH);
}
