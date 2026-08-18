/** دمج أصناف CSS مع تجاهل القيم الفارغة — بديل خفيف عن clsx. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
