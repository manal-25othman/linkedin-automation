/**
 * بذور البيانات — كتالوج عربي واقعي، وحساب أدمن، ومسوّق تجريبي.
 * الملف قابل لإعادة التشغيل: يستعمل upsert بمفاتيح ثابتة فلا يُنشئ نسخًا مكرّرة.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const categories = [
  {
    slug: "government",
    name: "الخدمات الحكومية",
    description: "إنهاء المعاملات والمنصّات الحكومية نيابة عنك.",
    icon: "building",
    sortOrder: 1,
  },
  {
    slug: "translation",
    name: "الترجمة والتوثيق",
    description: "ترجمة معتمدة للمستندات الرسمية والشهادات.",
    icon: "languages",
    sortOrder: 2,
  },
  {
    slug: "academic",
    name: "الخدمات الطلابية والأكاديمية",
    description: "بحث وتنسيق ومراجعة لغوية وعروض تقديمية.",
    icon: "graduation",
    sortOrder: 3,
  },
  {
    slug: "business",
    name: "خدمات الأعمال",
    description: "سجل تجاري، خطط عمل، فواتير، وحسابات منصّات.",
    icon: "briefcase",
    sortOrder: 4,
  },
  {
    slug: "design",
    name: "التصميم والهوية",
    description: "شعارات، هويات بصرية، سِيَر ذاتية، ومحتوى مرئي.",
    icon: "palette",
    sortOrder: 5,
  },
  {
    slug: "marketing",
    name: "التسويق الرقمي",
    description: "إدارة حسابات، إعلانات، وكتابة محتوى.",
    icon: "megaphone",
    sortOrder: 6,
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

const services: ServiceSeed[] = [
  {
    slug: "absher-transactions",
    category: "government",
    title: "إنهاء معاملات أبشر والمنصّات الحكومية",
    summary: "تجديد، إصدار، ومتابعة معاملاتك في المنصّات الحكومية دون طوابير.",
    description: [
      "نتولّى إدخال بياناتك ومتابعة معاملتك خطوةً بخطوة حتى صدورها، ونبلغك بالمستجدّات أولًا بأول.",
      "نعمل على المنصّات الرسمية بمعلومات تزوّدنا بها أنت، ولا نطلب كلمات مرور دائمة — رمز تحقّق لحظي فقط عند الحاجة.",
    ],
    requirements: ["رقم الهوية أو الإقامة", "نوع المعاملة المطلوبة", "المستندات الداعمة إن وُجدت"],
    isFeatured: true,
    sortOrder: 1,
    tiers: [
      {
        name: "معاملة واحدة",
        price: 12_000,
        deliveryDays: 2,
        features: ["معاملة واحدة", "متابعة حتى الإصدار", "تقرير بالحالة"],
        sortOrder: 1,
      },
      {
        name: "ثلاث معاملات",
        price: 30_000,
        deliveryDays: 3,
        features: ["حتى ٣ معاملات", "أولوية في التنفيذ", "متابعة يومية", "دعم واتساب"],
        sortOrder: 2,
      },
      {
        name: "باقة الأسرة",
        price: 55_000,
        deliveryDays: 5,
        features: ["حتى ٦ معاملات", "لأكثر من فرد", "مدير حساب مخصّص", "تقرير شهري"],
        sortOrder: 3,
      },
    ],
  },
  {
    slug: "certified-translation",
    category: "translation",
    title: "ترجمة معتمدة للمستندات الرسمية",
    summary: "ترجمة عربي/إنجليزي معتمدة تُقبل لدى الجهات الرسمية والسفارات.",
    description: [
      "ترجمة دقيقة مع ختم معتمد، ومراجعة لغوية قبل التسليم.",
      "نلتزم بالسرّية التامّة، وتُحذف نسخ مستنداتك من أنظمتنا بعد التسليم بثلاثين يومًا.",
    ],
    requirements: ["صورة واضحة من المستند", "اللغة المطلوبة", "تهجئة الأسماء كما في جواز السفر"],
    commissionBps: 1200,
    isFeatured: true,
    sortOrder: 2,
    tiers: [
      {
        name: "مستند واحد",
        price: 9_000,
        deliveryDays: 2,
        features: ["حتى صفحتين", "ختم معتمد", "نسخة PDF"],
        sortOrder: 1,
      },
      {
        name: "حزمة مستندات",
        price: 24_000,
        deliveryDays: 3,
        features: ["حتى ٦ صفحات", "ختم معتمد", "نسخة مطبوعة عند الطلب", "مراجعة مجانية"],
        sortOrder: 2,
      },
      {
        name: "ملفّ ابتعاث كامل",
        price: 48_000,
        deliveryDays: 5,
        features: ["حتى ١٥ صفحة", "تنسيق حسب متطلبات الجهة", "أولوية تنفيذ", "تعديلات غير محدودة"],
        sortOrder: 3,
      },
    ],
  },
  {
    slug: "research-assistance",
    category: "academic",
    title: "مساعدة بحثية وتنسيق الرسائل العلمية",
    summary: "مراجع، تنسيق APA، تدقيق لغوي، وضبط الاقتباسات — بلا كتابة نيابةً عنك.",
    description: [
      "نساعدك في تنظيم بحثك: بناء الهيكل، ضبط المراجع، التنسيق الأكاديمي، والتدقيق اللغوي.",
      "لا نكتب الأبحاث بدلًا عن الطالب ولا نؤدّي اختبارات نيابة عنه — هذه خدمة مساندة تلتزم بأخلاقيات البحث.",
    ],
    requirements: ["ملفّ البحث بصيغة Word", "دليل التنسيق المطلوب من جامعتك", "موعد التسليم"],
    isFeatured: true,
    sortOrder: 3,
    tiers: [
      {
        name: "تدقيق وتنسيق",
        price: 15_000,
        deliveryDays: 3,
        features: ["حتى ٢٠ صفحة", "تنسيق أكاديمي", "تدقيق لغوي"],
        sortOrder: 1,
      },
      {
        name: "تنسيق + مراجع",
        price: 32_000,
        deliveryDays: 4,
        features: ["حتى ٥٠ صفحة", "ضبط المراجع والاقتباسات", "قائمة مصادر منسّقة", "مراجعة واحدة"],
        sortOrder: 2,
      },
      {
        name: "رسالة كاملة",
        price: 75_000,
        deliveryDays: 7,
        features: ["حتى ١٢٠ صفحة", "فهرسة تلقائية", "ملخّص عربي وإنجليزي", "مراجعتان"],
        sortOrder: 3,
      },
    ],
  },
  {
    slug: "commercial-registration",
    category: "business",
    title: "تأسيس السجل التجاري وفتح المتجر الإلكتروني",
    summary: "من السجل التجاري إلى وثيقة العمل الحر ومنصّة الأعمال — بخطوات واضحة.",
    description: [
      "نجهّز أوراقك ونتابع إصدار السجل، ثم نربطك بالمتطلبات التالية: العنوان الوطني، الفاتورة الإلكترونية، وحساب المنصّة.",
      "نوضّح لك الرسوم الحكومية قبل البدء، وهي غير شاملة في سعر الخدمة.",
    ],
    requirements: ["هوية صاحب النشاط", "الاسم التجاري المقترح", "النشاط المطلوب"],
    commissionBps: 2000,
    sortOrder: 4,
    tiers: [
      {
        name: "وثيقة عمل حر",
        price: 15_000,
        deliveryDays: 2,
        features: ["إصدار الوثيقة", "شرح المزايا", "دعم بعد الإصدار"],
        sortOrder: 1,
      },
      {
        name: "سجل تجاري",
        price: 45_000,
        deliveryDays: 4,
        features: ["إصدار السجل", "العنوان الوطني", "تفعيل منصّة الأعمال", "استشارة ٣٠ دقيقة"],
        sortOrder: 2,
      },
      {
        name: "حزمة الانطلاق",
        price: 95_000,
        deliveryDays: 7,
        features: ["سجل تجاري", "فاتورة إلكترونية", "شعار ومتجر إلكتروني بسيط", "متابعة شهر"],
        sortOrder: 3,
      },
    ],
  },
  {
    slug: "cv-and-linkedin",
    category: "design",
    title: "سيرة ذاتية احترافية وتحسين لينكدإن",
    summary: "سيرة تمرّ من أنظمة الفرز ATS، وملفّ لينكدإن يجذب الفرص.",
    description: [
      "نعيد صياغة خبراتك بلغة النتائج لا المهامّ، ونصمّمها بصيغة تقرؤها أنظمة التوظيف الآلية.",
      "الباقات الأعلى تشمل تحسين ملفّك في لينكدإن وخطاب تعريفي مخصّص لكل وظيفة.",
    ],
    requirements: ["سيرتك الحالية أو نقاط عن خبرتك", "الوظيفة المستهدفة", "اللغة المطلوبة"],
    isFeatured: true,
    sortOrder: 5,
    tiers: [
      {
        name: "سيرة ذاتية",
        price: 12_000,
        deliveryDays: 2,
        features: ["تصميم متوافق مع ATS", "نسخة PDF و Word", "تعديل واحد"],
        sortOrder: 1,
      },
      {
        name: "سيرة + لينكدإن",
        price: 22_000,
        deliveryDays: 3,
        features: ["كل ما سبق", "تحسين ملفّ لينكدإن", "خطاب تعريفي", "تعديلان"],
        sortOrder: 2,
      },
      {
        name: "حزمة التوظيف",
        price: 39_000,
        deliveryDays: 5,
        features: ["كل ما سبق", "نسختان عربية وإنجليزية", "تدريب مقابلة ٤٥ دقيقة", "تعديلات شهر"],
        sortOrder: 3,
      },
    ],
  },
  {
    slug: "social-media-management",
    category: "marketing",
    title: "إدارة حسابات التواصل الاجتماعي",
    summary: "خطة محتوى وتصاميم ونشر منتظم لحسابك خلال الشهر.",
    description: [
      "نبني خطة محتوى شهرية مبنيّة على جمهورك ومنافسيك، ثم ننفّذها تصميمًا ونشرًا ومتابعة.",
      "تقرير شهري بالأرقام: الوصول، التفاعل، ونموّ المتابعين — وما سنغيّره في الشهر التالي.",
    ],
    requirements: ["روابط حساباتك", "هوية بصرية إن وُجدت", "أهدافك من الحساب"],
    commissionBps: 2500,
    sortOrder: 6,
    tiers: [
      {
        name: "خطة محتوى",
        price: 45_000,
        deliveryDays: 5,
        features: ["خطة شهر كاملة", "نصوص المنشورات", "أفكار قصص"],
        sortOrder: 1,
      },
      {
        name: "إدارة شهرية",
        price: 120_000,
        deliveryDays: 30,
        features: ["١٦ منشورًا مصمّمًا", "نشر ومتابعة", "ردود على التعليقات", "تقرير شهري"],
        sortOrder: 2,
      },
      {
        name: "إدارة + إعلانات",
        price: 220_000,
        deliveryDays: 30,
        features: ["كل ما سبق", "إدارة حملات مدفوعة", "تحسين أسبوعي", "اجتماع شهري"],
        sortOrder: 3,
      },
    ],
  },
  {
    slug: "logo-and-identity",
    category: "design",
    title: "تصميم شعار وهوية بصرية",
    summary: "شعار بخيارات متعدّدة ودليل استخدام يحفظ ثبات علامتك.",
    description: [
      "نبدأ بفهم نشاطك وجمهورك، ثم نقدّم مسارات تصميم مختلفة لتختار منها، ونطوّر ما تختاره حتى الاكتمال.",
      "تسلّم الملفّات المفتوحة وصيغ التصدير كافّة، وتملك حقوق الاستخدام الكاملة.",
    ],
    requirements: ["اسم النشاط ونبذة عنه", "أمثلة لهويات تعجبك", "الألوان المفضّلة إن وُجدت"],
    sortOrder: 7,
    tiers: [
      {
        name: "شعار",
        price: 30_000,
        deliveryDays: 4,
        features: ["٣ مسارات تصميم", "تعديلان", "ملفّات PNG و SVG"],
        sortOrder: 1,
      },
      {
        name: "هوية مصغّرة",
        price: 65_000,
        deliveryDays: 7,
        features: ["شعار", "بطاقة عمل وترويسة", "دليل ألوان وخطوط", "٣ تعديلات"],
        sortOrder: 2,
      },
      {
        name: "هوية كاملة",
        price: 140_000,
        deliveryDays: 12,
        features: ["كل ما سبق", "قوالب سوشال ميديا", "دليل هوية مفصّل", "ملفّات مفتوحة"],
        sortOrder: 3,
      },
    ],
  },
  {
    slug: "business-plan",
    category: "business",
    title: "خطة عمل ودراسة جدوى",
    summary: "خطة قابلة للعرض على مستثمر أو جهة تمويل، بأرقام واقعية.",
    description: [
      "دراسة السوق والمنافسين، نموذج العمل، التوقّعات المالية لثلاث سنوات، وخطة التنفيذ.",
      "نبني الأرقام على مصادر معلنة ونوضّح افتراضاتها، فلا تُفاجأ بسؤال لا تملك إجابته.",
    ],
    requirements: ["فكرة المشروع", "الموقع والسوق المستهدف", "رأس المال المتوقّع"],
    sortOrder: 8,
    tiers: [
      {
        name: "ملخّص تنفيذي",
        price: 35_000,
        deliveryDays: 5,
        features: ["٨ صفحات", "نموذج العمل", "تحليل مبدئي"],
        sortOrder: 1,
      },
      {
        name: "خطة عمل",
        price: 90_000,
        deliveryDays: 10,
        features: ["٢٥ صفحة", "دراسة سوق", "توقّعات مالية ٣ سنوات", "مراجعة واحدة"],
        sortOrder: 2,
      },
      {
        name: "دراسة جدوى كاملة",
        price: 180_000,
        deliveryDays: 15,
        features: ["كل ما سبق", "تحليل حسّاسية", "عرض تقديمي للمستثمر", "جلسة عرض"],
        sortOrder: 3,
      },
    ],
  },
];

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
