/**
 * بذور البيانات — كتالوج عربي واقعي، وحساب أدمن، ومسوّق تجريبي.
 * الملف قابل لإعادة التشغيل: يستعمل upsert بمفاتيح ثابتة فلا يُنشئ نسخًا مكرّرة.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const categories = [
  {
    slug: "websites",
    name: "المواقع والمتاجر",
    description: "متاجر إلكترونية، مواقع أعمال، مواقع تعريفية، ومدوّنات.",
    icon: "globe",
    sortOrder: 1,
  },
  {
    slug: "branding",
    name: "الهوية والتصميم",
    description: "شعارات، هويات بصرية كاملة، ودليل استخدام.",
    icon: "palette",
    sortOrder: 2,
  },
  {
    slug: "social",
    name: "المحتوى وإدارة الحسابات",
    description: "بوستات إعلانية، خطط محتوى، وإدارة حسابات شهرية.",
    icon: "megaphone",
    sortOrder: 3,
  },
];

type TierSeed = {
  name: string;
  price: number;
  deliveryDays: number;
  features: string[];
  sortOrder: number;
};

type ServiceSeed = {
  slug: string;
  category: string;
  title: string;
  summary: string;
  description: string[];
  requirements: string[];
  commissionBps?: number;
  isFeatured?: boolean;
  sortOrder: number;
  tiers: TierSeed[];
};

/** الأسعار بالهللات: ٢٥٠٠ ريال = 250_000. */
const services: ServiceSeed[] = [
  {
    slug: "ecommerce-store",
    category: "websites",
    title: "تصميم متجر إلكتروني",
    summary: "متجر جاهز للبيع على سلّة أو زد أو شوبيفاي — بتصميم يخصّك لا قالب مكرّر.",
    description: [
      "نبني متجرك من الصفر: هوية الصفحة الرئيسية، صفحات المنتجات، سلة الشراء، وربط وسائل الدفع والشحن.",
      "نرفع منتجاتك بصورها وأوصافها ونضبط التصنيفات، ثم ندرّبك على الإدارة اليومية بنفسك بلا اعتماد علينا.",
      "الباقات الأعلى تشمل تحسين سرعة المتجر وربط التحليلات لتعرف من أين يأتي البيع فعلًا.",
    ],
    requirements: [
      "اسم المتجر وشعاره إن وُجد",
      "قائمة المنتجات بأسعارها وصورها",
      "حساب سلّة أو زد (نساعدك في فتحه)",
      "وسيلة الدفع والشحن المفضّلة",
    ],
    commissionBps: 1000,
    isFeatured: true,
    sortOrder: 1,
    tiers: [
      {
        name: "متجر الانطلاق",
        price: 250_000,
        deliveryDays: 7,
        features: [
          "تجهيز المتجر على سلّة أو زد",
          "رفع حتى ٢٠ منتجًا",
          "تخصيص الألوان والواجهة",
          "ربط الدفع والشحن",
          "تدريب ساعة على الإدارة",
        ],
        sortOrder: 1,
      },
      {
        name: "متجر احترافي",
        price: 550_000,
        deliveryDays: 12,
        features: [
          "تصميم واجهة مخصّصة لعلامتك",
          "رفع حتى ٧٥ منتجًا",
          "صفحة هبوط لعرض أو منتج مميّز",
          "ربط التحليلات وبكسل الإعلانات",
          "تحسين سرعة المتجر",
          "تدريب ساعتين + مراجعتان",
        ],
        sortOrder: 2,
      },
      {
        name: "متجر متكامل",
        price: 950_000,
        deliveryDays: 20,
        features: [
          "تصميم فريد بالكامل",
          "منتجات بلا حدّ",
          "كتابة أوصاف المنتجات",
          "ربط الفاتورة الإلكترونية",
          "تهيئة SEO أساسية",
          "متابعة ودعم شهر كامل",
        ],
        sortOrder: 3,
      },
    ],
  },
  {
    slug: "custom-website",
    category: "websites",
    title: "تصميم موقع إلكتروني",
    summary: "موقع أعمال متعدّد الصفحات، سريع، ومتجاوب مع الجوال، ولوحة تحكّم تديره بنفسك.",
    description: [
      "موقع مبنيّ على احتياج نشاطك: صفحات الخدمات، من نحن، الأعمال السابقة، ونماذج التواصل.",
      "التصميم متجاوب مع كل المقاسات، ومهيّأ للظهور في نتائج البحث من أول يوم.",
      "تستلم لوحة تحكّم تعدّل بها النصوص والصور بلا حاجة إلينا في كل تغيير.",
    ],
    requirements: [
      "وصف نشاطك وجمهورك",
      "الصفحات المطلوبة",
      "النصوص والصور إن توفّرت (وإلا نكتبها في الباقات الأعلى)",
      "أمثلة لمواقع تعجبك",
    ],
    commissionBps: 1000,
    isFeatured: true,
    sortOrder: 2,
    tiers: [
      {
        name: "موقع أساسي",
        price: 300_000,
        deliveryDays: 10,
        features: [
          "حتى ٥ صفحات",
          "تصميم متجاوب مع الجوال",
          "نموذج تواصل وربط واتساب",
          "لوحة تحكّم للنصوص والصور",
          "تدريب على الاستخدام",
        ],
        sortOrder: 1,
      },
      {
        name: "موقع أعمال",
        price: 650_000,
        deliveryDays: 18,
        features: [
          "حتى ١٢ صفحة",
          "تصميم مخصّص لهويتك",
          "كتابة نصوص الصفحات",
          "تهيئة SEO أساسية",
          "ربط التحليلات",
          "٣ مراجعات",
        ],
        sortOrder: 2,
      },
      {
        name: "موقع مخصّص",
        price: 1_200_000,
        deliveryDays: 30,
        features: [
          "صفحات بلا حدّ",
          "تصميم فريد من الصفر",
          "لغتان (عربي/إنجليزي)",
          "حجز مواعيد أو نظام عضويات",
          "تحسين سرعة متقدّم",
          "متابعة ودعم شهرين",
        ],
        sortOrder: 3,
      },
    ],
  },
  {
    slug: "landing-website",
    category: "websites",
    title: "تصميم موقع تعريفي",
    summary: "صفحة أو موقع مختصر يعرّف بنشاطك ويجمع طلبات العملاء — جاهز خلال أيام.",
    description: [
      "الأنسب لمن يريد حضورًا رقميًّا سريعًا: تعريف بالنشاط، الخدمات، وطريقة التواصل.",
      "يُبنى ليحوّل الزائر إلى محادثة: أزرار واتساب واتصال واضحة، ونموذج طلب قصير.",
    ],
    requirements: [
      "نبذة عن النشاط",
      "الخدمات التي تقدّمها",
      "معلومات التواصل وحسابات التواصل",
      "شعار وصور إن وُجدت",
    ],
    commissionBps: 1500,
    sortOrder: 3,
    tiers: [
      {
        name: "صفحة واحدة",
        price: 90_000,
        deliveryDays: 4,
        features: [
          "صفحة واحدة متكاملة",
          "متجاوبة مع الجوال",
          "أزرار واتساب واتصال",
          "ربط النطاق والاستضافة",
        ],
        sortOrder: 1,
      },
      {
        name: "تعريفي ٥ صفحات",
        price: 180_000,
        deliveryDays: 7,
        features: [
          "٥ صفحات",
          "معرض أعمال",
          "نموذج تواصل",
          "تهيئة SEO أساسية",
          "مراجعتان",
        ],
        sortOrder: 2,
      },
      {
        name: "تعريفي متكامل",
        price: 320_000,
        deliveryDays: 12,
        features: [
          "٨ صفحات",
          "كتابة النصوص",
          "لغتان (عربي/إنجليزي)",
          "خرائط ومواقع الفروع",
          "لوحة تحكّم + تدريب",
        ],
        sortOrder: 3,
      },
    ],
  },
  {
    slug: "blog-website",
    category: "websites",
    title: "تصميم مدوّنة مقالية",
    summary: "مدوّنة سريعة ومهيّأة لمحرّكات البحث، بتصنيفات وأرشيف ونظام نشر سهل.",
    description: [
      "مدوّنة مبنيّة للقراءة: تنسيق مريح للعين، سرعة عالية، وبنية عناوين تفهمها محرّكات البحث.",
      "تشمل التصنيفات والوسوم والأرشيف والبحث الداخلي، ولوحة تنشر منها مقالاتك بنفسك.",
      "الباقة الأعلى تشمل تهيئة SEO تقنية وخطة مواضيع أولى لتبدأ بمحتوى له اتجاه لا مقالات متفرّقة.",
    ],
    requirements: [
      "مجال المدوّنة وجمهورها",
      "التصنيفات المبدئية",
      "الشعار والهوية إن وُجدا",
      "أمثلة لمدوّنات تعجبك",
    ],
    commissionBps: 1500,
    sortOrder: 4,
    tiers: [
      {
        name: "مدوّنة أساسية",
        price: 150_000,
        deliveryDays: 6,
        features: [
          "تصميم مدوّنة متجاوب",
          "تصنيفات ووسوم",
          "لوحة نشر سهلة",
          "ربط النطاق",
        ],
        sortOrder: 1,
      },
      {
        name: "مدوّنة احترافية",
        price: 280_000,
        deliveryDays: 10,
        features: [
          "تصميم مخصّص لهويتك",
          "بحث داخلي وأرشيف",
          "نشرة بريدية",
          "مشاركة اجتماعية وتحليلات",
          "مراجعتان",
        ],
        sortOrder: 2,
      },
      {
        name: "مدوّنة + سيو ومحتوى",
        price: 490_000,
        deliveryDays: 15,
        features: [
          "كل ما سبق",
          "تهيئة SEO تقنية كاملة",
          "خطة ١٠ مواضيع أولى",
          "٣ مقالات جاهزة للنشر",
          "تدريب على الكتابة للسيو",
        ],
        sortOrder: 3,
      },
    ],
  },
  {
    slug: "logo-design",
    category: "branding",
    title: "تصميم شعار",
    summary: "شعار أصيل بمسارات متعدّدة تختار منها، وبكل الصيغ التي ستحتاجها.",
    description: [
      "نبدأ بفهم نشاطك وجمهورك ومنافسيك، ثم نقدّم مسارات مختلفة لا نسخة واحدة تقبلها أو ترفضها.",
      "تسلّم الملفّات المفتوحة والصيغ كافّة (SVG و PNG و PDF)، وتملك حقوق الاستخدام كاملة.",
    ],
    requirements: [
      "اسم النشاط ونبذة عنه",
      "الجمهور المستهدف",
      "ألوان أو أنماط تفضّلها",
      "أمثلة لشعارات تعجبك",
    ],
    commissionBps: 2000,
    isFeatured: true,
    sortOrder: 5,
    tiers: [
      {
        name: "شعار أساسي",
        price: 45_000,
        deliveryDays: 3,
        features: ["مسارا تصميم للاختيار", "تعديل واحد", "ملفّات PNG و SVG"],
        sortOrder: 1,
      },
      {
        name: "شعار احترافي",
        price: 95_000,
        deliveryDays: 5,
        features: [
          "٣ مسارات تصميم",
          "٣ تعديلات",
          "نسخ أفقية ورأسية",
          "نسخة أحادية اللون",
          "الملفّات المفتوحة",
        ],
        sortOrder: 2,
      },
      {
        name: "شعار + دليل استخدام",
        price: 180_000,
        deliveryDays: 8,
        features: [
          "كل ما سبق",
          "دليل استخدام الشعار",
          "لوحة ألوان وخطوط",
          "أيقونة حسابات التواصل",
          "تعديلات غير محدودة أسبوعين",
        ],
        sortOrder: 3,
      },
    ],
  },
  {
    slug: "brand-identity",
    category: "branding",
    title: "تصميم هوية بصرية",
    summary: "نظام بصري كامل يجعل علامتك تُعرف من النظرة الأولى في كل مكان تظهر فيه.",
    description: [
      "الهوية أوسع من الشعار: ألوان وخطوط وأنماط وقواعد استخدام تحفظ ثبات علامتك مع كل مصمّم يعمل معك لاحقًا.",
      "تشمل التطبيقات التي تحتاجها فعلًا: مطبوعات، قوالب سوشال ميديا، وتغليف عند الحاجة.",
    ],
    requirements: [
      "الشعار (أو نصمّمه ضمن الباقة)",
      "وصف النشاط وشخصيته",
      "التطبيقات التي تحتاجها",
      "أمثلة لهويات تعجبك",
    ],
    commissionBps: 1800,
    sortOrder: 6,
    tiers: [
      {
        name: "هوية مصغّرة",
        price: 150_000,
        deliveryDays: 7,
        features: [
          "لوحة ألوان وخطوط",
          "بطاقة عمل وترويسة",
          "دليل مختصر",
          "مراجعتان",
        ],
        sortOrder: 1,
      },
      {
        name: "هوية أعمال",
        price: 320_000,
        deliveryDays: 12,
        features: [
          "شعار ضمن الباقة",
          "نظام ألوان وخطوط وأنماط",
          "مطبوعات أساسية",
          "٦ قوالب سوشال ميديا",
          "دليل هوية مفصّل",
        ],
        sortOrder: 2,
      },
      {
        name: "هوية كاملة",
        price: 600_000,
        deliveryDays: 20,
        features: [
          "كل ما سبق",
          "تطبيقات موسّعة (تغليف/لافتات/زيّ)",
          "١٥ قالب سوشال ميديا",
          "دليل هوية احترافي بصيغة PDF",
          "الملفّات المفتوحة كاملة",
          "متابعة شهر",
        ],
        sortOrder: 3,
      },
    ],
  },
  {
    slug: "social-posts",
    category: "social",
    title: "تصميم بوستات إعلانية",
    summary: "تصاميم منشورات جاهزة للنشر — بمقاسات كل منصّة ونصوص تُقنع لا تزيّن فقط.",
    description: [
      "كل تصميم يُبنى على رسالة واحدة واضحة: عرض، أو خدمة، أو إعلان — لا زحام عناصر بلا هدف.",
      "تسلّم المقاسات كلّها (منشور، ستوري، إعلان) بصيغ جاهزة للنشر، والملفّات المفتوحة عند الطلب.",
    ],
    requirements: [
      "هويتك البصرية أو شعارك",
      "المواضيع أو العروض المطلوبة",
      "الصور والنصوص إن توفّرت",
      "المنصّات التي تنشر فيها",
    ],
    commissionBps: 2000,
    sortOrder: 7,
    tiers: [
      {
        name: "٨ بوستات",
        price: 60_000,
        deliveryDays: 4,
        features: ["٨ تصاميم", "مقاس منشور واحد", "تعديل واحد لكل تصميم"],
        sortOrder: 1,
      },
      {
        name: "١٦ بوست",
        price: 110_000,
        deliveryDays: 7,
        features: [
          "١٦ تصميمًا",
          "مقاسا منشور وستوري",
          "كتابة النصوص",
          "تعديلان لكل تصميم",
        ],
        sortOrder: 2,
      },
      {
        name: "٣٠ بوست + ستوري",
        price: 190_000,
        deliveryDays: 12,
        features: [
          "٣٠ تصميمًا",
          "كل المقاسات",
          "خطة نشر شهرية",
          "٥ تصاميم إعلانية",
          "الملفّات المفتوحة",
        ],
        sortOrder: 3,
      },
    ],
  },
  {
    slug: "social-media-management",
    category: "social",
    title: "إدارة حسابات التواصل",
    summary: "خطة محتوى وتصميم ونشر ومتابعة شهرية — حسابك يشتغل وأنت مشغول بعملك.",
    description: [
      "نبدأ بدراسة حسابك ومنافسيك وجمهورك، ثم نبني خطة شهرية وننفّذها تصميمًا ونشرًا وردودًا.",
      "تقرير شهري بالأرقام: الوصول، التفاعل، نموّ المتابعين، وما سنغيّره الشهر القادم ولماذا.",
      "الاشتراك شهري ويُجدَّد باختيارك، بلا التزام طويل.",
    ],
    requirements: [
      "روابط حساباتك وصلاحية النشر",
      "هويتك البصرية إن وُجدت",
      "أهدافك من الحساب",
      "المنتجات أو الخدمات المراد إبرازها",
    ],
    commissionBps: 2500,
    isFeatured: true,
    sortOrder: 8,
    tiers: [
      {
        name: "إدارة أساسية",
        price: 180_000,
        deliveryDays: 30,
        features: [
          "منصّة واحدة",
          "١٢ منشورًا شهريًّا",
          "خطة محتوى شهرية",
          "نشر ومتابعة",
          "تقرير شهري",
        ],
        sortOrder: 1,
      },
      {
        name: "إدارة احترافية",
        price: 350_000,
        deliveryDays: 30,
        features: [
          "منصّتان",
          "٢٠ منشورًا + ١٢ ستوري",
          "الردّ على التعليقات والرسائل",
          "تصوير محتوى شهري بسيط",
          "تقرير مفصّل + اجتماع شهري",
        ],
        sortOrder: 2,
      },
      {
        name: "إدارة + إعلانات",
        price: 650_000,
        deliveryDays: 30,
        features: [
          "٣ منصّات",
          "٣٠ منشورًا + ستوريات يومية",
          "إدارة الحملات المدفوعة",
          "تحسين أسبوعي للحملات",
          "مدير حساب مخصّص",
        ],
        sortOrder: 3,
      },
    ],
  },
];

/**
 * الكتالوج في هذا الملفّ هو المرجع: ما لم يعد فيه يُحذف إن لم يُطلب قطّ،
 * ويُعطَّل إن ارتبط بطلبات — حذف خدمة لها طلبات يقطع تاريخ بيع وعمولةً مبنيّة عليه.
 */
async function pruneStaleCatalog() {
  const keepSlugs = services.map((service) => service.slug);

  for (const service of services) {
    const saved = await prisma.service.findUnique({
      where: { slug: service.slug },
      select: { id: true },
    });
    if (!saved) continue;

    const keepNames = service.tiers.map((tier) => tier.name);
    const stale = await prisma.serviceTier.findMany({
      where: { serviceId: saved.id, name: { notIn: keepNames } },
      select: { id: true, _count: { select: { orders: true } } },
    });

    for (const tier of stale) {
      if (tier._count.orders === 0) {
        await prisma.serviceTier.delete({ where: { id: tier.id } });
      } else {
        await prisma.serviceTier.update({ where: { id: tier.id }, data: { isActive: false } });
      }
    }
  }

  const staleServices = await prisma.service.findMany({
    where: { slug: { notIn: keepSlugs } },
    select: { id: true, _count: { select: { orders: true } } },
  });

  for (const service of staleServices) {
    if (service._count.orders === 0) {
      await prisma.serviceTier.deleteMany({ where: { serviceId: service.id } });
      await prisma.service.delete({ where: { id: service.id } });
    } else {
      await prisma.service.update({ where: { id: service.id }, data: { isActive: false } });
      await prisma.serviceTier.updateMany({
        where: { serviceId: service.id },
        data: { isActive: false },
      });
    }
  }

  // التصنيف الفارغ فقط يُحذف؛ ما زال يحمل خدمات معطّلة يبقى لسلامة السجلّ.
  const staleCategories = await prisma.category.findMany({
    where: { slug: { notIn: categories.map((category) => category.slug) } },
    select: { id: true, _count: { select: { services: true } } },
  });

  for (const category of staleCategories) {
    if (category._count.services === 0) {
      await prisma.category.delete({ where: { id: category.id } });
    } else {
      await prisma.category.update({ where: { id: category.id }, data: { isActive: false } });
    }
  }
}

async function main() {
  console.log("بدء تهيئة البيانات…");

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: category,
      update: category,
    });
  }

  const categoryIds = new Map(
    (await prisma.category.findMany({ select: { id: true, slug: true } })).map((row) => [
      row.slug,
      row.id,
    ]),
  );

  for (const service of services) {
    const categoryId = categoryIds.get(service.category);
    if (!categoryId) continue;

    const data = {
      title: service.title,
      summary: service.summary,
      description: service.description.join("\n"),
      requirements: service.requirements.join("\n"),
      categoryId,
      commissionBps: service.commissionBps ?? null,
      isFeatured: service.isFeatured ?? false,
      sortOrder: service.sortOrder,
      isActive: true,
    };

    const saved = await prisma.service.upsert({
      where: { slug: service.slug },
      create: { slug: service.slug, ...data },
      update: data,
      select: { id: true },
    });

    for (const tier of service.tiers) {
      const existing = await prisma.serviceTier.findFirst({
        where: { serviceId: saved.id, name: tier.name },
        select: { id: true },
      });

      const tierData = {
        serviceId: saved.id,
        name: tier.name,
        price: tier.price,
        deliveryDays: tier.deliveryDays,
        features: tier.features.join("\n"),
        sortOrder: tier.sortOrder,
        isActive: true,
      };

      if (existing) {
        await prisma.serviceTier.update({ where: { id: existing.id }, data: tierData });
      } else {
        await prisma.serviceTier.create({ data: tierData });
      }
    }
  }

  await pruneStaleCatalog();

  // حساب الإدارة — كلمة المرور من البيئة، ولا قيمة افتراضية في الإنتاج.
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim() || "admin@anjez.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim();

  if (!adminPassword && process.env.NODE_ENV === "production") {
    throw new Error("SEED_ADMIN_PASSWORD مطلوب في الإنتاج.");
  }

  const passwordHash = await bcrypt.hash(adminPassword || "Anjez12345", 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: "مدير المنصّة",
      passwordHash,
      role: "ADMIN",
    },
    update: { role: "ADMIN" },
  });

  console.log(`حساب الإدارة: ${adminEmail}`);
  if (!adminPassword) {
    console.log("كلمة المرور الافتراضية للتطوير: Anjez12345 — غيّرها فورًا.");
  }

  // مسوّق تجريبي في التطوير فقط، ليعمل تدفّق الإحالة كاملًا بلا تسجيل يدوي.
  if (process.env.NODE_ENV !== "production") {
    const partnerHash = await bcrypt.hash("Partner12345", 12);
    const partner = await prisma.user.upsert({
      where: { email: "partner@anjez.local" },
      create: {
        email: "partner@anjez.local",
        name: "شريك تجريبي",
        phone: "+966500000000",
        passwordHash: partnerHash,
        role: "AFFILIATE",
      },
      update: {},
      select: { id: true },
    });

    await prisma.affiliate.upsert({
      where: { userId: partner.id },
      create: {
        userId: partner.id,
        code: "ANJEZ1",
        status: "ACTIVE",
        approvedAt: new Date(),
        promotionPlan: "حساب تجريبي للتطوير: قناة تيليجرام ومجموعات واتساب.",
      },
      update: { status: "ACTIVE" },
    });

    console.log("مسوّق تجريبي: partner@anjez.local / Partner12345 — الكود ANJEZ1");
  }

  console.log("اكتملت التهيئة.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
