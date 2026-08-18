import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "سياسة الخصوصية",
  description: "كيف تجمع منصّة أنجز بياناتك وتستخدمها وتحميها.",
};

const sections = [
  {
    title: "ما الذي نجمعه",
    items: [
      "بيانات الطلب: الاسم، رقم الجوال، البريد الإلكتروني (اختياري)، وتفاصيل ما تطلبه.",
      "بيانات المسوّقين: الاسم، البريد، الجوال، وبيانات التحويل البنكي لصرف المستحقات.",
      "بيانات الإحالة: كود المسوّق ووقت النقر، ويُخزَّن عنوان الاتصال مهشَّمًا لا خامًا.",
    ],
  },
  {
    title: "ما الذي لا نجمعه",
    items: [
      "بيانات البطاقات البنكية — تُدخل مباشرة لدى بوّابة الدفع ولا تمرّ بخوادمنا.",
      "أي بيانات تتبّع إعلانية لأطراف ثالثة دون علمك.",
    ],
  },
  {
    title: "ملفّات الارتباط",
    items: [
      "كوكي الجلسة: لتسجيل دخول المسوّقين والإدارة، وهو ضروري لعمل الحساب.",
      "كوكي الإحالة: يحفظ كود المسوّق الذي جئت عبره طوال نافذة الإحالة، ولا يحمل أي بيانات شخصية عنك.",
    ],
  },
  {
    title: "المشاركة مع الغير",
    items: [
      "بوّابة الدفع: لتنفيذ عملية الدفع وحدها.",
      "مزوّدو الخدمة المنفّذون: بقدر ما يلزم لتنفيذ طلبك فقط.",
      "الجهات النظامية: عند طلب رسمي ملزم.",
    ],
  },
  {
    title: "حقوقك",
    items: [
      "طلب نسخة من بياناتك أو تصحيحها أو حذفها، عدا ما يلزم الاحتفاظ به لأغراض محاسبية ونظامية.",
      "الاعتراض على أي تواصل تسويقي، مع بقاء الرسائل التشغيلية الخاصة بطلباتك.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="font-display text-3xl font-extrabold">سياسة الخصوصية</h1>

      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-display text-xl font-bold">{section.title}</h2>
            <ul className="mt-3 space-y-2">
              {section.items.map((item) => (
                <li key={item} className="flex gap-2 leading-relaxed text-ink-soft">
                  <span className="text-brand">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
