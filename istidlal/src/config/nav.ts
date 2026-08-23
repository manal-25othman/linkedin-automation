/** روابط التنقّل الرئيسية والذيل. مصدر واحد للترويسة والذيل وخريطة الموقع. */
export const primaryNav = [
  { href: "/articles", label: "المقالات" },
  { href: "/categories", label: "التصنيفات" },
  { href: "/tools", label: "الأدوات" },
  { href: "/about", label: "عن استدلال" },
  { href: "/contact", label: "تواصل" },
] as const;

export const legalNav = [
  { href: "/editorial-policy", label: "سياسة التحرير" },
  { href: "/advertising-policy", label: "سياسة الإعلانات" },
  { href: "/privacy-policy", label: "سياسة الخصوصية" },
  { href: "/cookie-policy", label: "سياسة الكوكيز" },
  { href: "/terms", label: "شروط الاستخدام" },
  { href: "/disclaimer", label: "إخلاء المسؤولية" },
] as const;
