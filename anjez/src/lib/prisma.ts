import { PrismaClient } from "@prisma/client";

/**
 * في وضع التطوير يعيد Next تحميل الوحدات عند كل تعديل، وإنشاء عميل Prisma
 * جديد في كل مرة يستنزف اتصالات قاعدة البيانات — لذلك نحتفظ به على globalThis.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * وقت البناء تُولَّد مئات الصفحات الساكنة بالتوازي عبر عدة عمليات عاملة، بينما
 * `DATABASE_URL` في الإنتاج مضبوط على `connection_limit=1` — وهو الصحيح للدوال
 * بلا خوادم، لكنه يخنق البناء فتفشل الصفحات بـ P2024. لذا يستخدم البناء الاتصال
 * المباشر (`DIRECT_URL`)، ويبقى التشغيل على المجمّع كما هو.
 */
const datasourceUrl =
  process.env.NEXT_PHASE === "phase-production-build"
    ? process.env.DIRECT_URL || process.env.DATABASE_URL
    : undefined;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
