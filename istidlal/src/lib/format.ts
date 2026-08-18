/** تنسيق التواريخ بالعربية مع أرقام لاتينية — أوضح للقارئ التقني. */
const dateFormatter = new Intl.DateTimeFormat("ar", {
  year: "numeric",
  month: "long",
  day: "numeric",
  numberingSystem: "latn",
  calendar: "gregory",
});

export function formatDate(iso: string): string {
  if (!iso) return "";
  return dateFormatter.format(new Date(`${iso}T00:00:00Z`));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ar", { numberingSystem: "latn" }).format(value);
}
