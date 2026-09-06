# ملف التقديم — رخصة ريادة الأعمال (منشآت ← وزارة الاستثمار)

> انسخي النصوص من هنا إلى النموذجين، وصدّريهما PDF، ووقّعيهما. الحقول
> المعلَّمة **⚠️** لا أعرف قيمتها — املئيها أنتِ.

---

## ١) قائمة ما يُرسَل — تحقّقي منها قبل الضغط على «إرسال»

| # | المطلوب | الحالة |
|---|---|---|
| ١ | **Startup Brief** موقّع بصيغة PDF | النصّ جاهز أدناه |
| ٢ | **Letter of Intent** موقّع بصيغة PDF | النصّ والأرقام جاهزة أدناه |
| ٣ | **ملف تعريف الشركة** | استخدمي عرضك التقديمي في `docs/sales/` |
| ٤ | نسخة من **الإقامة** | ⚠️ عندك |
| ٥ | **خطاب عدم ممانعة مصدّق من الغرفة التجارية** | ⚠️ **انتبهي — التصديق شرط** |
| ٦ | معلومات في متن الإيميل (٧ بنود) | جاهزة أدناه |

> ⚠️ **أهم نقطة قد تُعيد طلبك**: الإيميل يشترط أن يكون خطاب عدم الممانعة
> **مصدّقًا من الغرفة التجارية** — لا مجرد خطاب من جهة عملك. إن لم يكن
> مصدّقًا، صدّقيه قبل الإرسال، وإلا رجع الطلب بعد أسابيع.

---

## ٢) Startup Brief — النصّ جاهزًا

| الحقل | ما تكتبينه |
|---|---|
| **(EN-AR) Company Name** | ⚠️ **الاسم لم يُحسم بعد** — اكتبي الاسم المختار بالعربي والإنجليزي. ولو لم تحسميه بعد، اكتبي الاسم الحالي مع `(name pending trade-name reservation)` |
| **Establishment date** | `Not yet incorporated — product in production since 2026. Incorporation pending this license.` |
| **Website** | ⚠️ رابط منصتك الحالي |
| **Country of Origin (HQ) & branches** | `No existing legal entity. The founder is a resident of Saudi Arabia and intends to incorporate the company in Saudi Arabia (⚠️ المدينة) as its headquarters. No branches.` |
| **Shareholders & their nationalities** | `Manal Al-Areqi — 100% — ⚠️ الجنسية` |
| **VCs** | `None. The company is fully bootstrapped and self-funded.` |
| **Incubation or acceleration programs** | `None to date.` |
| **Closed VC rounds** | `None. No external capital has been raised.` |
| **Sector** | `Information Technology — Enterprise SaaS / Applied Artificial Intelligence (Arabic-first knowledge management)` |

### Brief about company

> An Arabic-first enterprise knowledge platform. Organisations upload their
> own regulations, policies and procedure manuals; their employees then ask
> questions in natural Arabic and receive answers generated **only** from
> those documents, with the source document and page number cited on every
> answer.
>
> The platform is live in production today. It performs hybrid retrieval
> (vector plus full-text search tuned for Arabic), repairs the character
> corruption typical of Arabic PDFs, reads scanned documents and images
> through OCR, and runs a deterministic verifier that checks every number
> in an answer against its source text before the answer is shown.
>
> Business activities: software development and operation of a cloud-based
> (SaaS) knowledge management platform, sold by monthly and annual
> subscription to private-sector organisations in Saudi Arabia.

### Competitive advantage

> **1. Arabic is the design constraint, not a translation layer.** Retrieval,
> chunking and text repair are built for Arabic documents. Generic platforms
> mis-read Arabic PDFs; this one detects and repairs that corruption before
> indexing.
>
> **2. Every answer is traceable.** The source document and page are shown
> with each answer, and a deterministic (non-model) verifier cross-checks
> the figures in the answer against the source, so numeric errors cannot
> pass silently. The verifier cannot hallucinate because it does not infer.
>
> **3. Tenant isolation is enforced in the database and proven by tests.**
> Isolation is implemented in PostgreSQL row-level security rather than
> application code, and is covered by 232 automated tests plus mutation
> testing: the guards are deliberately disabled in a test build and the
> suite must fail — which it does.
>
> **4. Scanned Arabic documents are usable.** Circulars and manuals that
> exist only as scans are read page by page and indexed like any other
> document — a large share of the archives of the target customers.

---

## ٣) Letter of Intent — الأرقام

مشتقّة من **السيناريو الأساسي** في خطتك التشغيلية (`docs/product/12-OPERATING-PLAN-3Y.md`)،
بسعر الصرف الثابت ٣٫٧٥ ريال للدولار.

### الاثنا عشر شهرًا القادمة

| البند | القيمة | المصدر |
|---|---|---|
| CapEx + OpEx | **≈ 36,000 USD** | تكاليف السنة ١ = ١٣٥٬٢٩٩ ريال |
| عدد التوظيف | **2** | المؤسِّسة + مسؤول بيع عند ~١٥ عميلًا |
| الإيرادات التراكمية | **≈ 62,000 USD** | إيراد السنة ١ = ٢٣٣٬٦٢٠ ريال |

### الخمس سنوات القادمة

| البند | القيمة |
|---|---|
| CapEx + OpEx | **≈ 1,400,000 USD** |
| عدد التوظيف | **8** |
| الإيرادات التراكمية | **≈ 2,300,000 USD** |

> ⚠️ **اقرئي هذا قبل أن تكتبي أرقام الخمس سنوات**: خطتك موثّقة **لثلاث
> سنوات فقط**. السنتان الرابعة والخامسة **استقراء مني** بافتراض تباطؤ
> النمو (٢٫٥ ثم ٣٫٥ مليون ريال إيرادًا). راجعيها واقتنعي بها قبل التوقيع —
> أنتِ من يوقّع لا أنا، وستُسألين عنها لاحقًا.

**بقية حقول الخطاب**: الاسم، التاريخ، الشركة، الهاتف، البريد، العنوان،
والصفة `Founder`.

---

## ٤) متن الإيميل — انسخيه كما هو وأكملي ⚠️

> السلام عليكم ورحمة الله وبركاته،
>
> شكرًا لتواصلكم. أرفق لكم النماذج المطلوبة موقّعة، والمعلومات المطلوبة أدناه:
>
> • **أسماء المساهمين**: منال العارقي — ١٠٠٪
> • **الجنسية**: ⚠️
> • **حالة المتقدم**: فرد
> • **الهوية**: إقامة رقم ⚠️ (نسخة مرفقة)
> • **النشاط التجاري**: ⚠️ رقم واسم النشاط من التصنيف الوطني
> • **المدينة داخل المملكة**: ⚠️
> • **رأس مال الشركة الناشئة**: ⚠️
>
> **المرفقات**: ملخص الشركة الناشئة (PDF موقّع) · خطاب النوايا (PDF موقّع) · ملف تعريف الشركة · صورة الإقامة · خطاب عدم ممانعة مصدّق من الغرفة التجارية
>
> المنصة تعمل في الإنتاج اليوم ويمكنكم تجربتها مباشرة على: ⚠️ الرابط
>
> وتفضلوا بقبول خالص التحية،
> منال العارقي — المؤسِّسة
> ⚠️ الجوال · ⚠️ البريد

---

## ٥) النشاط التجاري — كيف تجدين الرقم

من [التصنيف الوطني للأنشطة الاقتصادية](https://www.stats.gov.sa/) — والأقرب لنشاطك:

| الرمز | النشاط | ملاحظة |
|---|---|---|
| **6201** | أنشطة برمجة الحاسب | **الأرجح** — تطوير وتشغيل برمجيات |
| 6311 | معالجة البيانات والاستضافة والأنشطة المتصلة | بديل إن طُلب تصنيف الاستضافة |
| 6202 | أنشطة الاستشارات في مجال الحاسب | لا يصف نشاطك بدقة |

⚠️ **تحققي من الرمز على موقع الهيئة** — الأرقام تُحدَّث، والإيميل اشترط
صراحةً أن يكون التصنيف **تحت قطاع التقنية**، و6201 يحقق ذلك.

---

## ٦) رأس المال — كيف تختارين الرقم

لا حدّ أدنى إلزامي لرخصة ريادة الأعمال، لكن الرقم يجب أن **يتّسق مع خطتك**.

خطتك تقول: أقصى احتياج نقدي في السيناريو المتحفّظ **~٤٣ ألف ريال**.

فرقم بين **٥٠٬٠٠٠ و١٠٠٬٠٠٠ ريال** معقول ومتّسق: يغطي أسوأ سيناريو في خطتك
مع هامش، ولا يبدو مبالغًا فيه لشركة برمجيات بلا أصول ثابتة.

**لا تكتبي رقمًا ضخمًا لتبدو جادّة** — ستُسألين عن مصدره، وقد يُطلب إثباته.

---

## ٧) ما ينقصك فعلًا — ستة حقول

١. **الاسم** (عربي وإنجليزي) ← ما زال غير محسوم
٢. **الجنسية**
٣. **رقم الإقامة**
٤. **المدينة**
٥. **رأس المال**
٦. **رمز النشاط** من stats.gov.sa

وكل ما عداها جاهز في هذا الملف.
