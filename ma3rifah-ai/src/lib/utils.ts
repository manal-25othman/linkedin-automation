import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AR_NUMBER_FORMAT = new Intl.NumberFormat('ar-SA', { useGrouping: true });

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return AR_NUMBER_FORMAT.format(value);
}

export function formatCurrency(
  amount: number | null | undefined,
  currency = 'SAR',
): string {
  if (amount === null || amount === undefined) return 'حسب الطلب';
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value)}%`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 ب';
  const units = ['ب', 'ك.ب', 'م.ب', 'ج.ب'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/** «منذ ٣ ساعات» */
export function formatRelativeTime(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '—';

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('ar-SA', { numeric: 'auto' });

  const divisions: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.34524, 'week'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ];

  let duration = diffSeconds;
  for (const [amount, unit] of divisions) {
    if (Math.abs(duration) < amount) {
      return rtf.format(Math.round(duration), unit);
    }
    duration /= amount;
  }
  return formatDate(date);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

/** يُستخدم لتوليد slug للشركات */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[؀-ۿ]/g, '') // إسقاط الحروف العربية — الـslug لاتيني
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `co-${Math.random().toString(36).slice(2, 8)}`;
}
