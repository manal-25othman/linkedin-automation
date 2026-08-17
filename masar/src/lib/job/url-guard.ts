import 'server-only';

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { AppError } from '@/lib/errors';

/**
 * حارس الطلبات الصادرة (SSRF).
 *
 * الرابط يأتي من المستخدم ويُجلب من الخادم، فبلا حارس يتحوّل المسار إلى
 * وكيل يقرأ ما لا يصله المستخدم: خدمات الشبكة الداخلية، وواجهة بيانات
 * الاعتماد في مزوّدات السحابة على 169.254.169.254. لذلك يُحلّ اسم المضيف
 * ويُفحص العنوان الناتج قبل كل قفزة، لا مرة واحدة في البداية — فإعادة
 * التوجيه هي المنفذ الذي تُلتف منه الفحوص التي تنظر إلى الرابط الأول فقط.
 */

/** يحوّل «::ffff:10.0.0.1» إلى «10.0.0.1» ليُفحص بقواعد IPv4 */
function unwrapMappedIpv4(address: string): string | null {
  const match = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  return match?.[1] ?? null;
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a = 0, b = 0] = parts;

  if (a === 0) return true; // 0.0.0.0/8 — «هذه الشبكة»
  if (a === 10) return true; // خاص
  if (a === 127) return true; // حلقة محلية
  if (a === 169 && b === 254) return true; // link-local، ومنها بيانات اعتماد السحابة
  if (a === 172 && b >= 16 && b <= 31) return true; // خاص
  if (a === 192 && b === 168) return true; // خاص
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a >= 224) return true; // بثّ متعدد ومحجوز

  return false;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0] ?? '';
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fe80')) return true; // link-local
  if (/^f[cd]/.test(normalized)) return true; // unique local (fc00::/7)
  if (normalized.startsWith('ff')) return true; // multicast
  return false;
}

export function isPrivateAddress(address: string): boolean {
  const mapped = unwrapMappedIpv4(address);
  if (mapped) return isPrivateIpv4(mapped);
  if (isIP(address) === 6) return isPrivateIpv6(address);
  if (isIP(address) === 4) return isPrivateIpv4(address);
  return true; // ما لا يُفهم لا يُوثق به
}

/**
 * يتحقق أن الرابط عام وصالح للجلب.
 * يرمي AppError برسالة عربية إن لم يكن كذلك.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new AppError('VALIDATION', 'الرابط غير صالح. تأكد أنه يبدأ بـ https://');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new AppError('VALIDATION', 'يُقبل رابط https فقط.');
  }

  if (url.username || url.password) {
    throw new AppError('VALIDATION', 'الرابط يحتوي بيانات اعتماد — احذفها وأعد المحاولة.');
  }

  const host = url.hostname;

  // عنوان رقمي مباشر: يُفحص كما هو بلا استعلام DNS
  if (isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new AppError('VALIDATION', 'لا يمكن جلب روابط الشبكة الداخلية.');
    }
    return url;
  }

  let records: Array<{ address: string }>;
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new AppError('JOB_FETCH_FAILED', 'تعذّر العثور على الموقع. تأكد من الرابط.');
  }

  if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
    throw new AppError('VALIDATION', 'لا يمكن جلب روابط الشبكة الداخلية.');
  }

  return url;
}
