import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_COMMISSION_SETTINGS,
  type CommissionSettings,
} from "@/lib/affiliate/commission";

/**
 * إعدادات يغيّرها الأدمن من اللوحة دون إعادة نشر. المفاتيح نصّية في القاعدة،
 * والقراءة تُرجع دائمًا قيمة صالحة: أي مفتاح مفقود أو تالف يسقط إلى القيمة
 * الافتراضية بدل أن يُعطّل صفحة الطلب أو حساب العمولة.
 */
export const SETTING_KEYS = {
  defaultBps: "commission.defaultBps",
  maxBps: "commission.maxBps",
  bonusSilver: "commission.bonus.silver",
  bonusGold: "commission.bonus.gold",
  thresholdSilver: "commission.threshold.silver",
  thresholdGold: "commission.threshold.gold",
  holdDays: "commission.holdDays",
  attributionWindowDays: "commission.attributionWindowDays",
  minPayout: "commission.minPayout",
  autoApprove: "commission.autoApprove",
  contactWhatsapp: "site.whatsapp",
  contactEmail: "site.email",
} as const;

function toInt(value: string | undefined, fallback: number): number {
  if (value == null) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export type SiteSettings = {
  commission: CommissionSettings;
  /** اعتماد العمولات المستحقّة تلقائيًا بدل مراجعة يدوية لكل عمولة. */
  autoApprove: boolean;
  contactWhatsapp: string;
  contactEmail: string;
};

async function readAll(): Promise<Map<string, string>> {
  const rows = await prisma.setting.findMany().catch(() => []);
  return new Map(rows.map((row) => [row.key, row.value]));
}

export const getSettings = cache(async (): Promise<SiteSettings> => {
  const map = await readAll();
  const d = DEFAULT_COMMISSION_SETTINGS;

  return {
    commission: {
      defaultBps: toInt(map.get(SETTING_KEYS.defaultBps), d.defaultBps),
      maxBps: toInt(map.get(SETTING_KEYS.maxBps), d.maxBps),
      tierBonusBps: {
        BRONZE: 0,
        SILVER: toInt(map.get(SETTING_KEYS.bonusSilver), d.tierBonusBps.SILVER),
        GOLD: toInt(map.get(SETTING_KEYS.bonusGold), d.tierBonusBps.GOLD),
      },
      tierThresholds: {
        silver: toInt(map.get(SETTING_KEYS.thresholdSilver), d.tierThresholds.silver),
        gold: toInt(map.get(SETTING_KEYS.thresholdGold), d.tierThresholds.gold),
      },
      holdDays: toInt(map.get(SETTING_KEYS.holdDays), d.holdDays),
      attributionWindowDays: toInt(
        map.get(SETTING_KEYS.attributionWindowDays),
        d.attributionWindowDays,
      ),
      minPayout: toInt(map.get(SETTING_KEYS.minPayout), d.minPayout),
    },
    autoApprove: (map.get(SETTING_KEYS.autoApprove) ?? "true") === "true",
    contactWhatsapp: map.get(SETTING_KEYS.contactWhatsapp) ?? "",
    contactEmail: map.get(SETTING_KEYS.contactEmail) ?? "",
  };
});

export async function saveSettings(values: Record<string, string>): Promise<void> {
  const entries = Object.entries(values);
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    ),
  );
}
