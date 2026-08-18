import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { formatBps } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "الشروط والأحكام",
  description: "شروط استخدام منصّة أنجز وشروط برنامج التسويق بالعمولة.",
};

export default async function TermsPage() {
  const { commission } = await getSettings();

  const sections = [
    {
      title: "١. طبيعة الخدمة",
      items: [
        "أنجز وسيط ينفّذ خدمات إلكترونية عبر فريقه ومزوّديه المعتمدين، ولا يمثّل أي جهة حكومية ولا يتحدّث باسمها.",
        "ما تراه في صفحة كل خدمة (نطاق العمل، مدّة التسليم، السعر) هو الملزم للطرفين.",
      ],
    },
    {
      title: "٢. الدفع والاسترجاع",
      items: [
        "الدفع مقدَّم عبر بوّابة دفع إلكترونية، ولا نحتفظ ببيانات بطاقتك على خوادمنا.",
        "يُستردّ المبلغ كاملًا إن لم نبدأ التنفيذ، أو إن تعذّر إنجاز الخدمة لسبب من طرفنا.",
        "بعد بدء التنفيذ يُحسب المستردّ بقدر ما لم يُنفَّذ من نطاق العمل.",
      ],
    },
    {
      title: "٣. مسؤوليات العميل",
      items: [
        "تزويدنا بالمعلومات والمستندات الصحيحة في وقتها؛ التأخير فيها يمدّ مدّة التسليم بالمثل.",
        "عدم طلب ما يخالف الأنظمة، أو ما يتضمّن انتحال صفة أو تزوير مستندات.",
      ],
    },
    {
      title: "٤. برنامج التسويق بالعمولة",
      items: [
        `العمولة نسبة من قيمة الطلب بعد الخصم، أساسها ${formatBps(commission.defaultBps)} وقد تختلف حسب الخدمة والمستوى.`,
        `تُنسب الزيارة للمسوّق خلال ${commission.attributionWindowDays} يومًا من النقر على رابطه، وعند اجتماع كود خصم مع رابط تُنسب لصاحب الكود.`,
        `تُعتمد العمولة بعد اكتمال الطلب بـ ${commission.holdDays} يومًا (مدّة الضمان والاسترجاع)، وتُلغى إن أُلغي الطلب أو استُرجع مبلغه.`,
        `يجوز طلب السحب عند بلوغ الرصيد المعتمد ${formatMoney(commission.minPayout)}، ويُحوَّل على آيبان باسم المسوّق نفسه.`,
        "يُمنع: الرسائل المزعجة، والإعلانات المدفوعة على اسم المنصّة أو نطاقها، وانتحال صفة موظف رسمي، والوعود بنتائج لا تلتزم بها الخدمة. المخالفة توقف الحساب وتُلغي العمولات غير المصروفة.",
        "لا يجوز للمسوّق استخدام كوده على طلباته الشخصية أو طلبات يدفعها بنفسه لأخذ خصم وعمولة معًا.",
      ],
    },
    {
      title: "٥. تعديل الشروط",
      items: [
        "قد تُحدَّث هذه الشروط، ويسري التحديث على الطلبات والعمولات اللاحقة لتاريخه لا على ما سبقه.",
      ],
    },
  ];

  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="font-display text-3xl font-extrabold">الشروط والأحكام</h1>
      <p className="mt-2 text-sm text-ink-muted">آخر تحديث: عند آخر نشر للمنصّة.</p>

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
