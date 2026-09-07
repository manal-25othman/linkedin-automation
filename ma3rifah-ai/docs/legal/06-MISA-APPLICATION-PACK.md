# ملف التقديم — رخصة ريادة الأعمال (منشآت ← وزارة الاستثمار)

> انسخي النصوص من هنا إلى النموذجين، وصدّريهما PDF، ووقّعيهما. الحقول
> المعلَّمة **⚠️** لا أعرف قيمتها — املئيها أنتِ.

---

## ١) قائمة ما يُرسَل — تحقّقي منها قبل الضغط على «إرسال»

| # | المطلوب | الحالة |
|---|---|---|
| ١ | **Startup Brief** موقّع بصيغة PDF | النصّ جاهز أدناه |
| ٢ | **Letter of Intent** موقّع بصيغة PDF | النصّ والأرقام جاهزة أدناه |
| ٣ | **ملف تعريف الشركة** | `docs/legal/badiha-license-deck.pdf` — عشر شرائح بالبنية التي قُبلت لملفات مشابهة |
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
| **(EN-AR) Company Name** | `Badiha — بديهة` (وأضيفي `(trade-name reservation in progress)` إن لم يكتمل الحجز في وزارة التجارة قبل الإرسال) |
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

مشتقّة من **السيناريو المتحفّظ** في خطتك التشغيلية (`docs/product/12-OPERATING-PLAN-3Y.md`)،
بسعر الصرف الثابت ٣٫٧٥ ريال للدولار. اختير المتحفّظ عمدًا: الخطاب إقرار لجهة
حكومية، ورقم متواضع يتحقق أسلم من رقم كبير يُسأل عنه.

| | السنة ١ | السنة ٢ | السنة ٣ | السنة ٤ | السنة ٥ |
|---|---|---|---|---|---|
| العملاء نهاية السنة | ٥ | ١٩ | ٣٩ | ~٦١ | ~٨٦ |
| إيراد السنة (ريال) | ٧٨ ألف | ٣٤٦ ألف | ٨٠٤ ألف | ~١٫٣ مليون | ~١٫٩ مليون |
| الفريق (بما فيه المؤسِّسة) | ١ | ٢ | ٣–٤ | ٥ | ٦–٧ |

> السنتان الرابعة والخامسة امتداد بنفس وتيرة المتحفّظ (~٢٥ عميلًا جديدًا سنويًا)، لا قفزة.

### الاثنا عشر شهرًا القادمة

| البند | القيمة |
|---|---|
| CapEx + OpEx | **≈ 31,000 USD** |
| عدد التوظيف | **1** |
| الإيرادات التراكمية | **≈ 21,000 USD** |

### الخمس سنوات القادمة

| البند | القيمة |
|---|---|
| CapEx + OpEx | **≈ 850,000 USD** |
| عدد التوظيف | **6** |
| الإيرادات التراكمية | **≈ 1,180,000 USD** |

**بقية حقول الخطاب**: الاسم، التاريخ، الشركة (`Badiha — بديهة`)، الهاتف، البريد،
العنوان، والصفة `Founder`.

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
> • **النشاط التجاري**: 620113 (رئيسي) · 620102 · 620111 · 582001 — ⚠️ مع الوصف الرسمي
> • **المدينة داخل المملكة**: ⚠️
> • **رأس مال الشركة الناشئة**: 20,000 ريال سعودي
>
> **المرفقات**: ملخص الشركة الناشئة (PDF موقّع) · خطاب النوايا (PDF موقّع) · ملف تعريف الشركة · صورة الإقامة · خطاب عدم ممانعة مصدّق من الغرفة التجارية
>
> المنصة تعمل في الإنتاج اليوم ويمكنكم تجربتها مباشرة على: ⚠️ الرابط
>
> وتفضلوا بقبول خالص التحية،
> منال العارقي — المؤسِّسة
> ⚠️ الجوال · ⚠️ البريد

---

## ٥) النشاط التجاري — الرموز

الرموز التي قُبلت في ملف مشابه (ملف أخيك)، وكلها تحت قطاع التقنية كما اشترط الإيميل:

| الرمز | الاستخدام |
|---|---|
| **620113** | النشاط الرئيسي |
| 620102 | مساند |
| 620111 | مساند |
| 582001 | مساند (نشر البرمجيات) |

⚠️ انسخي **الوصف الرسمي** لكل رمز من منصة التصنيف الوطني للأنشطة الاقتصادية
(stats.gov.sa) وقت التعبئة؛ الأوصاف تُحدَّث ولا أكتبها هنا من الذاكرة.

---

## ٦) رأس المال — ردّ منشآت (وصل)

ردّت منشآت على الاستفسار، وهذا ما ثبت:

| السؤال | جوابهم |
|---|---|
| هل رأس المال مطلوب؟ | نعم، متطلب أساسي ضمن البيانات، **يحدّده مقدّم الطلب** بالريال أو بالدولار |
| الحد الأدنى | **5,000 ريال** |
| الحد الأعلى | لم يُذكر حدّ أعلى |
| هل يُشترط إيداعه عند التأسيس؟ | «تأمّل الاستفسار من وزارة التجارة» — ليس من اختصاصهم |
| هل يُعدَّل لاحقًا؟ | **خطاب الدعم يمكن تعديله لاحقًا**؛ وما يخصّ التأسيس والسجل التجاري يُسأل عنه في وزارة التجارة |

**القرار: 20,000 ريال سعودي.** أربعة أضعاف الحدّ الأدنى، والرقم الذي قُبل في ملف
أخيك، ويتّسق مع شركة برمجيات بلا أصول ثابتة. وبما أن خطاب الدعم قابل للتعديل،
لا خسارة في البدء به.

⚠️ سؤال الإيداع عند التأسيس يُطرح على وزارة التجارة بعد صدور رخصة الاستثمار،
لا الآن؛ فهو مرحلة لاحقة ولا يعطّل هذا الطلب.

---

## ٦-ب) ملف تعريف الشركة — اشتراط منشآت

نصّ جوابهم: يجب أن يشمل **نظرة عامة للمشروع، الخدمات والحلول المقدَّمة،
النشاطات التجارية الرئيسية، والقطاعات المستهدفة — بصيغة باوربوينت**.

الملف `docs/legal/badiha-license-deck.pptx` — ثماني شرائح:

| # | الشريحة | يغطّي |
|---|---|---|
| ١ | الغلاف | الاسم والتعريف |
| ٢ | المقدمة: السياق والتحدي | ربط برؤية ٢٠٣٠ |
| ٣ | نبذة عن المشروع | **نظرة عامة** + النشاط ورموز التصنيف |
| ٤ | المميزات المنفَّذة | **الخدمات والحلول** — ٢٠ ميزة في ٥ محاور + قنوات الوصول |
| ٥ | الذكاء الاصطناعي داخل المنصة | ٧ أدوار منها وكيلان + ٤ ركائز حتمية بلا نموذج |
| ٦ | نموذج العمل والسوق والقيمة | **النشاطات الرئيسية والقطاعات المستهدفة** + القيمة المضافة |
| ٧ | المالية والتوظيف ٥ سنوات | مطابقة لخطاب النوايا |
| ٨ | خارطة التطوّر وخطة التوسع | أربع مراحل (٢ منشورتان) + استوديو السياسات (غير منشور) + المملكة ← الخليج ← الأسواق العربية |

أرسليه **PPTX** كما طلبوا، وأرفقي PDF معه احتياطًا.

> **قاعدة محفوظة في الملف**: الشريحة ٨ وحدها تصف ميزة غير منشورة، وهي
> معلَّمة صراحةً «مواصفة معتمدة ولم تُنشر بعد». وما عداها يعمل في
> الإنتاج اليوم ويمكن عرضه حيًّا.

---

## ٧) ما ينقصك فعلًا — ستة حقول

١. **الجنسية**
٢. **رقم الإقامة**
٣. **المدينة**
٤. **النموذجان المحدَّثان** المرفقان في ردّ منشآت (نموذج بيانات خطاب الدعم + آخر نسخة من نماذج وزارة الاستثمار) — أرسليهما لتعبئتهما بالنصوص أعلاه
٥. **الأوصاف الرسمية** لرموز النشاط من stats.gov.sa

وكل ما عداها جاهز في هذا الملف.
