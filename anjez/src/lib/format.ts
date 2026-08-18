const dateFormatter = new Intl.DateTimeFormat("ar-SA", {
  year: "numeric",
  month: "long",
  day: "numeric",
  numberingSystem: "latn",
  calendar: "gregory",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ar-SA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  numberingSystem: "latn",
  calendar: "gregory",
});

export function formatDate(value: Date | string): string {
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(new Date(value));
}

const numberFormatter = new Intl.NumberFormat("ar-SA", { numberingSystem: "latn" });

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** النِسَب مخزّنة bps: 1500 → «15٪». */
export function formatBps(bps: number): string {
  const percent = bps / 100;
  return `${numberFormatter.format(Number(percent.toFixed(2)))}٪`;
}

export function formatRelativeDays(target: Date, now: Date = new Date()): string {
  const days = Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "مستحقّة الآن";
  if (days === 1) return "بعد يوم";
  if (days === 2) return "بعد يومين";
  if (days <= 10) return `بعد ${formatNumber(days)} أيام`;
  return `بعد ${formatNumber(days)} يومًا`;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "بانتظار الدفع",
  PAID: "مدفوع",
  IN_PROGRESS: "قيد التنفيذ",
  DELIVERED: "تم التسليم",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغى",
  REFUNDED: "مسترجع",
};

export const COMMISSION_STATUS_LABELS: Record<string, string> = {
  PENDING: "معلّقة",
  APPROVED: "معتمدة",
  PAID: "مصروفة",
  CANCELLED: "ملغاة",
};

export const PAYOUT_STATUS_LABELS: Record<string, string> = {
  REQUESTED: "طلب جديد",
  PROCESSING: "قيد التحويل",
  PAID: "تم الصرف",
  REJECTED: "مرفوض",
};

export const AFFILIATE_STATUS_LABELS: Record<string, string> = {
  PENDING: "بانتظار الاعتماد",
  ACTIVE: "مفعّل",
  SUSPENDED: "موقوف",
  REJECTED: "مرفوض",
};

export const AFFILIATE_TIER_LABELS: Record<string, string> = {
  BRONZE: "برونزي",
  SILVER: "فضّي",
  GOLD: "ذهبي",
};

export const ATTRIBUTION_LABELS: Record<string, string> = {
  NONE: "مباشر",
  LINK: "رابط إحالة",
  COUPON: "كود خصم",
};
