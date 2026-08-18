/**
 * كل المبالغ في هذا المشروع أعداد صحيحة بالهللات (1 ريال = 100 هللة).
 * السبب: العمولات نِسَب مئوية من مبالغ، وحسابها على أعداد عشرية عائمة يُنتج
 * فروق كسور تتراكم بين ما يراه المسوّق وما يُصرف له فعلًا.
 */

export const HALALAS_PER_RIYAL = 100;

export function riyalsToHalalas(riyals: number): number {
  return Math.round(riyals * HALALAS_PER_RIYAL);
}

export function halalasToRiyals(halalas: number): number {
  return halalas / HALALAS_PER_RIYAL;
}

/** يحوّل نصًّا مُدخلًا من نموذج (بالريالات) إلى هللات، أو null إن كان غير صالح. */
export function parseRiyalsInput(value: string | null | undefined): number | null {
  if (value == null) return null;
  const normalized = String(value)
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[,\s]/g, "")
    .trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return riyalsToHalalas(parsed);
}

const formatter = new Intl.NumberFormat("ar-SA", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  numberingSystem: "latn",
});

/** صيغة العرض: «١٬٢٥٠ ر.س» بأرقام لاتينية لسهولة القراءة في الجداول. */
export function formatMoney(halalas: number): string {
  return `${formatter.format(halalasToRiyals(halalas))} ر.س`;
}

/** بدون لاحقة العملة — للجداول التي ترويستها تحمل العملة. */
export function formatAmount(halalas: number): string {
  return formatter.format(halalasToRiyals(halalas));
}
