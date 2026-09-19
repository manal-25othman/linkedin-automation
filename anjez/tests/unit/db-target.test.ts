import { describe, expect, it } from "vitest";
import { checkSeedPassword, isRemoteDatabaseUrl } from "@/lib/db-target";

describe("isRemoteDatabaseUrl", () => {
  it("يعتبر القواعد المحلّية محلّية", () => {
    expect(isRemoteDatabaseUrl("postgresql://u:p@localhost:5432/anjez")).toBe(false);
    expect(isRemoteDatabaseUrl("postgresql://u:p@127.0.0.1:5432/anjez?schema=public")).toBe(false);
  });

  it("يعتبر مزوّدي الاستضافة قواعد بعيدة", () => {
    expect(isRemoteDatabaseUrl("postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/anjez")).toBe(true);
    expect(isRemoteDatabaseUrl("postgresql://u:p@db.abc.supabase.co:5432/postgres")).toBe(true);
  });

  it("يفترض الأسوأ عند غياب الرابط أو تلفه", () => {
    // قاعدة مجهولة تُعامَل كحيّة: الخطأ في الاتجاه الآخر قد يُفسد بيانات حقيقية.
    expect(isRemoteDatabaseUrl(undefined)).toBe(true);
    expect(isRemoteDatabaseUrl("رابط-غير-صالح")).toBe(true);
    expect(isRemoteDatabaseUrl("")).toBe(true);
  });
});

describe("checkSeedPassword", () => {
  it("يرفض الفارغة والمنشورة في الوثائق", () => {
    expect(checkSeedPassword(undefined).ok).toBe(false);
    expect(checkSeedPassword("   ").ok).toBe(false);
    expect(checkSeedPassword("Anjez12345").ok).toBe(false);
    expect(checkSeedPassword("Partner12345").ok).toBe(false);
  });

  it("يرفض القصيرة وما خلا من حرف أو رقم", () => {
    expect(checkSeedPassword("abc123").ok).toBe(false);
    expect(checkSeedPassword("كلمةمرورطويلةبلاأرقام").ok).toBe(false);
    expect(checkSeedPassword("1234567890").ok).toBe(false);
  });

  it("يقبل كلمة مرور صالحة", () => {
    expect(checkSeedPassword("Manal2026Studio")).toEqual({ ok: true });
  });
});
