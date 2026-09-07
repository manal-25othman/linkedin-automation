# ١٤ — جرد الميزات (Feature Inventory)

> **الغرض:** مرجع ثابت قبل أي إعادة تصميم أو تغيير هوية. كل سطر هنا مأخوذ من
> الكود الفعلي (المسارات، الإجراءات، الصلاحيات، الجداول)، لا من الواجهة ولا من
> الوثائق التسويقية. القاعدة الحاكمة: **يُحفَظ الجوهر، وتُعاد صياغة العرض.**
>
> **كيف يُستخدم أثناء إعادة التصميم:** لكل سطر في الجداول أدناه، املأ عمودَي
> «الموقع الجديد» و«يعمل؟» بعد التنفيذ. لا يُعتبر التصميم مكتملًا وفي أي سطر
> فراغ. ما لا يُنقل يُوثَّق سببه هنا لا يُحذف بصمت.

**مصدر الجرد:** الفرع `main` — الهجرة الأخيرة `0038_expert_validation.sql` —
٥١ إجراء خادم — ١٩ صلاحية — ٣٧ جدولًا — ٦٦ ملف اختبار وحدة + ١١ ملف اختبار SQL.

---

## ٠. ما **ليس** موجودًا (ممنوع عرضه في التصميم الجديد)

هذه ادّعاءات شائعة في مواقع المنافسين وليست في الكود. تُذكر فقط تحت
«تحسينات مستقبلية مقترحة» إن ذُكرت:

| الادّعاء | الحالة الفعلية |
|---|---|
| تكامل Slack / Teams / Google Drive / SharePoint | غير موجود. القناة الوحيدة خارج الويب هي واتساب. |
| API عام أو مفاتيح API للعملاء | غير موجود. لا توجد نقطة نهاية عامة موثّقة للعملاء. |
| SSO / SAML / تسجيل دخول Microsoft أو Google | غير موجود. بريد + كلمة مرور فقط. |
| تطبيق جوال | غير موجود. ويب متجاوب فقط. |
| تحرير المستندات داخل المنصة | غير موجود. رفع، وصف، صلاحيات، أرشفة، حذف فقط. |
| تدريب نموذج خاص بالشركة | غير موجود. استرجاع (RAG) على مستندات الشركة. |
| تعدد اللغات في الواجهة | غير موجود. الواجهة عربية بالكامل. المستندات الإنجليزية تُفهرس. |
| تقارير مجدولة بالبريد | غير موجود. |
| سجل إصدارات للمستندات | غير موجود. إعادة الرفع = مستند جديد (مع كشف التكرار بالبصمة). |
| شهادات ISO / SOC 2 | لا توجد شهادة. ورقة الأمان (`docs/legal/04`) تصف الضوابط الفعلية فقط. |
| أرقام عملاء / شهادات عملاء | لا يوجد عميل يدفع بعد. ممنوع اختلاق أي رقم. |

---

## ١. الحسابات والدخول

| الميزة | الموقع الحالي | الآلية | الموقع الجديد | يعمل؟ |
|---|---|---|---|---|
| تسجيل شركة جديدة (اسم الشركة + مدير + رمز دعوة) | `/register` | `registerAction` · `REGISTRATION_MODE` · `redeem_invite_code` | | |
| تسجيل الدخول | `/login` | `loginAction` · جلسة موقّعة `SESSION_SECRET` | | |
| نسيت كلمة المرور / إعادة تعيين | `/forgot-password` · `/reset-password` | `requestPasswordResetAction` · `updatePasswordAction` | | |
| رابط وصول عبر البريد (magic link) | `/auth/callback` | Supabase Auth | | |
| تسجيل الخروج من هذا الجهاز / من كل الأجهزة | القائمة العلوية · `/settings/profile` | `logoutAction` · `logoutEverywhereAction` | | |
| بطاقة الجلسة (متى بدأت، الجهاز) | `/settings/profile` | `SessionCard` | | |
| إعداد أول مدير منصة | `/setup` | `SUPER_ADMIN_EMAIL/PASSWORD` مرة واحدة | | |
| حماية المسارات على الخادم | `src/middleware.ts` | ١٤ مسارًا محميًا + توجيه المسجَّل بعيدًا عن `/login` | | |

## ٢. الأدوار والصلاحيات (RBAC)

| الدور | التسمية | ما يملكه |
|---|---|---|
| `EMPLOYEE` | موظف | `documents.view` `categories.view` `assistant.use` `conversations.view_own` |
| `MANAGER` | مدير قسم | + `users.view` `departments.view` `knowledge_gaps.view` `analytics.view_department` |
| `COMPANY_ADMIN` | مدير الشركة | + `company.manage` `company.view_settings` `users.manage` `departments.manage` `documents.manage` `categories.manage` `knowledge_gaps.manage` `analytics.view_company` `audit.view` `billing.view` |
| `SUPER_ADMIN` | مدير المنصة | كل الصلاحيات + `platform.manage` |

- مصدر الحقيقة: `src/lib/auth/rbac.ts` (واجهة) + `guards.ts` (خادم) + RLS (قاعدة البيانات).
- **قاعدة لا تتغير في أي تصميم:** الشريط الجانبي يخفي ما لا يملكه الدور، لكن الخادم وRLS هما من يمنع.
- عزل الشركات: `current_company_id()` · `belongs_to_current_company()` · `can_read_document()` · اختبارات `tests/sql/02` و`08` مع مجموعة تحكم بالطفرات `90_mutation.sql`.

## ٣. التنقل الحالي (لوحة الشركة)

| المجموعة | العنصر | المسار | صلاحية العرض |
|---|---|---|---|
| — | الرئيسية | `/dashboard` | `assistant.use` |
| — | المساعد الذكي | `/assistant` | `assistant.use` |
| المعرفة | قاعدة المعرفة | `/knowledge-base` | `categories.view` |
| المعرفة | المستندات | `/documents` | `documents.view` |
| المعرفة | المحادثات | `/conversations` | `conversations.view_own` |
| الرؤى | فجوات المعرفة | `/knowledge-gaps` | `knowledge_gaps.view` |
| الرؤى | التحليلات | `/analytics` | `analytics.view_department` |
| الإدارة | المستخدمون | `/users` | `users.view` |
| الإدارة | الاشتراك والفواتير | `/settings/billing` | `billing.view` |
| الإدارة | الأقسام | `/departments` | `departments.view` |
| الإدارة | الدعم الفني | `/support` | `assistant.use` |
| الإدارة | الإعدادات | `/settings` | `company.view_settings` |
| غير في الشريط | المساعدة | `/help` · `/help/[slug]` | كل المسجَّلين |
| غير في الشريط | الاستبيان | `/feedback` | كل المسجَّلين |
| غير في الشريط | أسئلة موجَّهة إليك | `/assigned` | من أُسنِدت إليه فجوة (بالإسناد لا بالدور) |
| غير في الشريط | الملف الشخصي | `/settings/profile` | كل المسجَّلين |

الشريط العلوي: جرس الإشعارات (`NotificationBell` · `unread_notification_count` · `markNotificationsReadAction`) · تسجيل الخروج.
المخطط: `AssistantWidget` عائم في كل صفحات اللوحة (`(dashboard)/layout.tsx`).

## ٤. الصفحة الرئيسية للوحة `/dashboard`

| الميزة | الآلية |
|---|---|
| بطاقات الأرقام (أسئلة، مستندات، مستخدمون، فجوات) | `company_dashboard_stats` |
| منحنى الأسئلة الزمني | `company_questions_timeseries` |
| أكثر الأسئلة تكرارًا | `company_top_questions` |
| النشاط الأخير | `company_recent_activity` |
| ملخص الاستهلاك مقابل حدود الخطة | `company_usage_summary` |
| شريط حالة الاشتراك (تجريبي/منتهٍ/بلا اشتراك) | `SubscriptionBanner` · `describeSubscription` |
| بطاقة الإعداد الأولي (خطوات البدء) | `OnboardingCard` |
| نافذة الترحيب للزيارة الأولى | `WelcomeDialog` |
| حالات فارغة مُوجِّهة (لا أسئلة / لا فجوات / لا نشاط) | نصوص موجودة في الصفحة |

## ٥. المساعد الذكي `/assistant` · `/assistant/[conversationId]`

| الميزة | الآلية | ملاحظة تصميمية |
|---|---|---|
| سؤال وجواب من مستندات الشركة (RAG) | `askAction` → `chat-service` · `match_document_chunks_hybrid` (بحث دلالي + نصي عربي `ar_normalize/ar_stem`) | الجواب يُبث تدريجيًا |
| احترام صلاحيات المستند لكل مستخدم | `match_chunks_for_user` · `can_read_document` | لا يُرى مقطع من مستند لا يملك المستخدم رؤيته |
| المصادر لكل جواب (المستند، الصفحة، القسم، المقتطف) | `message_sources` | |
| شارة الثقة (عالية/متوسطة/منخفضة) | `verify.ts` · `CONFIDENCE_THRESHOLDS` | حتمية، بلا نموذج |
| «لا أعرف» الصريحة بدل التخمين | `answer_status = UNANSWERED` → تُسجَّل فجوة | |
| تقييم الجواب 👍/👎 | `feedbackAction` · `messages.feedback` | يغذّي `company_answer_quality` |
| نسخ الجواب | زر Copy في `chat.tsx` | |
| أسئلة البداية (شرائح) | `starter_questions` في `companies.ai_settings` · `DEFAULT_STARTER_QUESTIONS` احتياطًا | يضبطها مدير الشركة |
| دعوة الاستبيان بعد ٥ إجابات | `SurveyNudge` · `FEEDBACK_SURVEY_MIN_ANSWERS` · تُخفى إن أُجيب | |
| قائمة المحادثات الجانبية + حذف | `conversation-list.tsx` · `deleteConversationAction` | |
| عنوان تلقائي للمحادثة | دور ذكاء مستقل (عنوان قصير) | |
| إعادة تسمية المحادثة | `renameConversationAction` | |
| المعرفة العامة (اختياري) | `allow_general_knowledge` | أسئلة السياسات تبقى مقيّدة بالمستندات دائمًا |
| حصص الأسئلة ومعدل الطلبات | `check_question_quota` · `check_rate_limit` | رسالة مهذّبة عند التجاوز، لا خطأ تقني |
| حماية من حقن الأوامر | `prompt-injection` · `injection-judges` (اختبارات) | |
| حالة «الذكاء غير مهيّأ» | `isAiConfigured()` | لا إجابات وهمية أبدًا |

## ٦. المستندات `/documents`

| الميزة | الآلية | من يملكها |
|---|---|---|
| رفع (PDF، DOCX، TXT، MD، PNG، JPEG، WEBP) حتى `MAX_FILE_SIZE_BYTES` | `createUploadTicketAction` → تخزين مباشر → `finalizeUploadAction` | `documents.manage` (مدير الشركة) |
| كشف التكرار بالبصمة | `content_hash` · صفحة مساعدة `duplicate-documents` | |
| الاستخراج النصي + التقسيم + التضمين | `ingest.ts` · `chunking` · `embeddings` (Voyage/OpenAI) | |
| **OCR للمسح الضوئي والصور** (رؤية النموذج) | `ocr.ts` · `document_ocr_pages` · `check_ocr_quota` · حصة شهرية لكل خطة | قابل للاستئناف عبر `continueProcessingAction` («متابعة المعالجة») |
| صلاحيات الرؤية: الشركة / القسم / الدور | `visibility` + `allowed_departments` + `allowed_roles` · `updateDocumentAction` | |
| تصنيف المستند (فئة + وصف) | `knowledge_categories` | |
| إعادة المعالجة | `reprocessDocumentAction` | |
| أرشفة / حذف | `archiveDocumentAction` · `deleteDocumentAction` | |
| تنزيل النسخة الأصلية (رابط موقّت) | `getDocumentDownloadUrl` | `documents.view` |
| حالة المعالجة (بانتظار/قيد/جاهز/فشل + سبب مفهوم) | `document-status.tsx` · إشعار `DOCUMENT_FAILED` | لا stack traces |
| حصص المستندات والتخزين | `check_document_quota` · `check_storage_quota` | |

## ٧. قاعدة المعرفة `/knowledge-base`

| الميزة | الآلية |
|---|---|
| تصفح بالفئات (بطاقات بعدد المستندات) | `CategoryCard` · `knowledge_categories` |
| إدارة الفئات (إنشاء/تعديل/حذف) | `createCategoryAction` · `updateCategoryAction` · `deleteCategoryAction` · `categories.manage` |
| لا تظهر إلا المستندات المسموح بها للمستخدم | RLS `can_read_document` |

## ٨. المحادثات `/conversations`

| الميزة | الآلية |
|---|---|
| قائمة محادثات المستخدم نفسه فقط | RLS مالك المحادثة (`0035_owner_isolation.sql`) |
| فتح المحادثة في المساعد | رابط إلى `/assistant/[id]` |
| حذف | `deleteConversationAction` |

> **قيد صريح:** مدير الشركة **لا** يرى محادثات الموظفين؛ يرى تجميعات التحليلات فقط. لا يُغيَّر هذا في التصميم.

## ٩. فجوات المعرفة `/knowledge-gaps`

| الميزة | الآلية |
|---|---|
| تجميع الأسئلة التي لم تُجب (مطبَّعة، مع عدّاد السائلين) | `record_knowledge_gap` · `normalize_question` · `knowledge_gap_askers` |
| تصفية حتمية للضجيج (تحية، اختبار…) | `gap-filter.ts` بلا نموذج |
| تغيير الحالة / كتابة إجابة معتمدة تُفهرس كمستند مصدره `CURATED_ANSWER` | `updateKnowledgeGapAction` · `curated-answer.ts` (`0014`) |
| **اقتراح مسودة إجابة** (وكيل) من المستندات | `suggestGapAnswerAction` · `gap-agent` |
| **توجيه الفجوة إلى خبير** — يراها هو وحده ويكتب مسوّدة يعتمدها المدير | `assignGapAction` · `/assigned` · `submit_expert_answer` (`0038`) |
| إشعار السائلين حين تُجاب الفجوة | `GAP_ANSWERED` |
| تصدير CSV | `/knowledge-gaps/export` |

## ١٠. التحليلات `/analytics`

| المؤشر | الدالة |
|---|---|
| ملخص الاستهلاك | `company_usage_summary` |
| المستخدمون النشطون | `company_active_users` |
| الأسئلة عبر الزمن | `company_questions_timeseries` |
| النشاط بالساعة | `company_hourly_activity` |
| الاستخدام بالأقسام | `company_department_usage` |
| أكثر الأسئلة / أكثر المستندات استشهادًا | `company_top_questions` · `company_top_documents` |
| جودة الإجابات (مُجاب/غير مُجاب/التقييمات) | `company_answer_quality` |
| ملخص التكلفة (لمدير الشركة) | `company_cost_summary` · `company_cost_breakdown` |
| مدير القسم يرى قسمه فقط | `analytics.view_department` مقابل `analytics.view_company` |

## ١١. المستخدمون والأقسام

| الميزة | المسار | الآلية |
|---|---|---|
| دعوة مستخدم (اسم، بريد، دور، قسم) | `/users` | `inviteUserAction` · `check_user_quota` |
| تعديل الدور/القسم/التفعيل | `/users` | `updateUserAction` |
| إعادة إرسال رابط الوصول | `/users` | `resendAccessLinkAction` |
| إدارة الأقسام | `/departments` | `createDepartmentAction` · `updateDepartmentAction` · `deleteDepartmentAction` |

## ١٢. الإعدادات

| الميزة | المسار | الآلية |
|---|---|---|
| بيانات الشركة (الاسم، القطاع) | `/settings` | `updateCompanyAction` |
| إعدادات المساعد: الأسلوب، أسئلة البداية، top-k، المقاطع، حد التشابه، نافذة السياق، المعرفة العامة | `/settings` | `updateAiSettingsAction` · `aiSettingsSchema` |
| سجل التدقيق (٣٦ نوع حدث) | `/settings` | `audit_logs` · `audit.view` |
| الملف الشخصي (الاسم، المسمّى) | `/settings/profile` | `updateProfileAction` |
| ربط واتساب برمز | `/settings/profile` | `requestWhatsAppLinkCodeAction` · `unlinkWhatsAppAction` · `whatsapp_links` |
| الاشتراك: الخطة الحالية، الأيام المتبقية، الاستهلاك، الدفع | `/settings/billing` | `SubscriptionStatusCard` · `startCheckoutAction` (Moyasar) · `payments` |

## ١٣. الدعم والاستبيان والمساعدة

| الميزة | المسار | الآلية |
|---|---|---|
| تذاكر دعم (فئة، أولوية، حالة، ردود) | `/support` · `/support/[ticketId]` | `createTicketAction` · `replyToTicketAction` · `updateTicketStatusAction` |
| استبيان الرضا (مرة لكل مستخدم) | `/feedback` | `submitFeedbackSurveyAction` · `feedback_surveys` |
| مركز المساعدة (١٣ مقالًا) | `/help` · `/help/[slug]` | `src/content/help.ts`: what-is-badiha · getting-started · upload-documents · document-permissions · duplicate-documents · asking-questions · confidence-and-sources · knowledge-gaps · roles · invite-users · analytics · subscription · troubleshooting |
| البدء السريع | `/help` | `QuickStart` |

> عند أي تغيير هوية: مقال «ما هي بديهة؟» (`what-is-badiha`) يُحدَّث محتواه ولا يُحذف.

## ١٤. الإشعارات (داخل المنصة)

| النوع | متى |
|---|---|
| `DOCUMENT_FAILED` | فشل معالجة مستند (لمن رفعه) |
| `GAP_OPENED` | سؤال جديد بلا إجابة (لمديري الشركة) |
| `GAP_ANSWERED` | أُجيبت فجوة سأل عنها المستخدم |
| `QUOTA_WARNING` | اقتراب الحصة الشهرية — تُنشأ من قاعدة البيانات `notify_quota_warning` (`0026`) |
| `GAP_ASSIGNED` | وُجّه إليك سؤال لتجيب عنه |
| `GAP_EXPERT_ANSWERED` | جواب خبير وصل وينتظر اعتماد مدير الشركة |

معرَّف في النوع ولا يُرسَل حاليًا من الكود: `DOCUMENT_READY` · `LOW_CONFIDENCE` (لا يُعرضان كميزة).

قراءة وتعليم كمقروء: `unread_notification_count` · `mark_notifications_read` · منع التكرار (`0019`).

## ١٥. واتساب (قناة ثانية للمساعد)

| الميزة | الآلية |
|---|---|
| استقبال الأسئلة والرد من نفس قاعدة المعرفة وبنفس صلاحيات المستخدم | `/api/whatsapp/webhook` · `handleIncomingMessage` |
| ربط الرقم برمز من الملف الشخصي | `request_whatsapp_link_code` |
| رسائل توجيه لغير المربوط | نصوص في `handler.ts` |
| التحقق من توقيع Meta | `WHATSAPP_APP_SECRET` |

## ١٦. الفوترة والخطط

| الميزة | الآلية |
|---|---|
| الخطط: TRIAL (٧ أيام/١٠ مستندات/٥٠ سؤالًا/٣ مستخدمين) · STARTER 899 · GROWTH 2,499 · BUSINESS 5,999 ر.س/شهر | جدول `plans` · `effective_plan_limit` |
| حدود: مستخدمون، مستندات، تخزين، أسئلة شهرية، صفحات OCR شهرية | `check_*_quota` |
| تسجيل الاستهلاك والتكلفة لكل عملية | `record_usage` · `ai_usage_logs` · `usage_records` |
| الدفع عبر Moyasar + webhook + تفعيل تلقائي | `/billing/callback` · `/api/webhooks/moyasar` · `settlePayment` · `activate_subscription_for_payment` |
| حالات الاشتراك (تجريبي، نشط، منتهٍ، بلا اشتراك) | `subscription-state.ts` |

## ١٧. لوحة مدير المنصة `/admin`

| الصفحة | المسار | ما فيها |
|---|---|---|
| نظرة عامة | `/admin` | الهامش، الرضا، جودة الفهرسة، الزوّار، أسئلة الزوّار غير المجابة، ملاحظات الاستبيان (`platform_*`) |
| المالية | `/admin/finance` | ملخص، ربحية كل شركة، مصروفات المنصة (`addPlatformExpenseAction` · `endPlatformExpenseAction`) |
| الدعوات | `/admin/invites` | إنشاء/إلغاء رموز، تقرير الاسترداد (`invite_codes_report`) |
| الشركات | `/admin/companies` · `/[companyId]` | القائمة، الاشتراك، الاستهلاك، التكلفة، تعليق/تفعيل (`setCompanyStatusAction`) |
| الدعم | `/admin/support` · `/[ticketId]` | كل التذاكر، الرد باسم المنصة (`platformReplyAction`) |
| محتوى الموقع | `/admin/content` | تحرير نصوص الموقع التسويقي (`saveSiteTextAction` · `site_content`) |
| الصفحات | `/admin/pages` | صفحات حرة `/p/[slug]` (إنشاء/تعديل/نشر/حذف) |
| الخطط | `/admin/plans` | تعديل الحدود والأسعار والظهور (`upsertPlanAction` · `setPlanVisibilityAction`) |
| الاستبيانات | `/admin/feedback` | كل الإجابات |
| تصدير | `/admin/export` | CSV |

## ١٨. الموقع التسويقي (عام)

| الصفحة | المسار | المكوّنات/المحتوى |
|---|---|---|
| الرئيسية | `/` | `FeatureShowcase` · `DemoConsole` (سيناريوهات **بيانات تجريبية** معلَّمة — «شركة الأفق (بيانات تجريبية)») · `Comparison` · `SecurityFlow` · `PricingTable` · `FaqList` · `Pulse` |
| المزايا | `/features` | بطاقات المزايا (٧ مجموعات نص) |
| كيف تعمل | `/how-it-works` | خطوات (٧ مجموعات نص) |
| الأسعار | `/pricing` | جدول الخطط + **حاسبة العائد** (`roi-calculator`) |
| الأمان | `/security` | ١٠ مجموعات نص + تدفق الأمان |
| من نحن | `/about` | ١٧ مجموعة نص |
| الأسئلة الشائعة | `/faq` | `src/content/faq.ts` |
| تواصل | `/contact` | نموذج → `contact_requests` |
| صفحات حرة | `/p/[slug]` | من `/admin/pages` |
| الخصوصية / الشروط | `/privacy` · `/terms` | `legal-layout` |
| ودجت دردشة الزائر | كل صفحات الموقع | `/api/site-chat` · `site_visitors` · `site_chat_messages` · حد للزائر |
| الوضع الليلي | الرأس | `theme-toggle` |
| زر واتساب | الرأس/التذييل | `NEXT_PUBLIC_WHATSAPP_NUMBER` |

كل النصوص التسويقية قابلة للتحرير من `/admin/content` (`site_content` · ٥٦٧ مفتاحًا في `site-text.ts`) — **إعادة التصميم تُغيّر الغلاف، والمفاتيح تبقى** كي لا تُفقد التعديلات المحفوظة في قاعدة البيانات.

## ١٩. أدوار الذكاء الاصطناعي في الكود (٧)

| # | الدور | الملف | نوعه |
|---|---|---|---|
| ١ | المساعد الرئيسي (RAG) | `lib/ai/chat-service.ts` | نموذج |
| ٢ | إعادة الصياغة الإنقاذية عند ضعف الاسترجاع | `chat-service.ts` | نموذج |
| ٣ | مسودة إجابة الفجوة | `knowledge-gaps/actions.ts` | **وكيل** (يبحث ثم يصوغ) |
| ٤ | دردشة زائر الموقع | `api/site-chat` | نموذج |
| ٥ | معالج واتساب | `lib/whatsapp/handler.ts` | **وكيل** (يربط الهوية ثم يسأل) |
| ٦ | عنوان المحادثة | `chat-service.ts` | نموذج |
| ٧ | OCR بالرؤية | `lib/rag/ocr.ts` | نموذج |

حتمية بلا نموذج: `verify.ts` (الثقة) · `gap-filter.ts` (تصفية الفجوات) · `ar_normalize/ar_stem` (SQL).

## ٢٠. الضوابط الأمنية التي يجب أن تبقى كما هي

- عزل الشركات عبر RLS في كل جدول؛ لا استعلام بعميل الخدمة في مسار مستخدم إلا بعد حارس خادم.
- `document_ocr_pages` و`rate_limit_counters`: محجوبة كليًا عن `authenticated` (بلا سياسات). `ai_usage_logs`: قراءة لمدير الشركة داخل شركته فقط.
- `knowledge_gaps`: الكتابة لمديري الشركة وحدهم. والخبير المُسنَد إليه يقرأ صفَّه فقط، ويكتب مسوّدته عبر دالّة واحدة تتحقق من الشركة ومن الإسناد وتكتب عمودين لا غير.
- المفاتيح في الخادم فقط (`.env.example` مرجع الأسماء).
- رسائل الخطأ للمستخدم بلا تفاصيل تقنية (`error-reference`).
- سجل التدقيق لا يحوي كلمات مرور ولا محتوى مستندات.
- الاختبارات: `tests/sql/*` (٢٣٢ حالة) + `90_mutation.sql` (يجب أن **تفشل** ٣٧ حالة عند فتح السياسات) + `tests/unit/*`.

## ٢١. ما يتغيّر مع الهوية الجديدة (قائمة لمس)

| العنصر | الموقع |
|---|---|
| الاسم | `NEXT_PUBLIC_APP_NAME` · `components/shared/brand` · `site-text.ts` (المفاتيح ذات الاسم) · `help.ts` (`what-is-badiha`) · `metadata` في `layout.tsx` · رسائل واتساب · قوالب البريد |
| الشعار والألوان | `components/shared/brand` · `globals.css` (رموز التصميم — اختبار `design-tokens`) · `public/` |
| الوثائق | `docs/product/*` · `docs/legal/04` و`05` و`06` · `docs/sales/*` · `README.md` |
| مفاتيح لا تتغيّر | مفاتيح `site_content` · المسارات · أسماء الجداول والدوال · الصلاحيات |

> **شرط مسبق:** لا يبدأ أي تغيير اسم قبل نتيجة الفحص الرسمي (SAIP الفئتان ٩ و٤٢ + حجز الاسم في وزارة التجارة + النطاق).

---

## تحسينات مستقبلية مقترحة (غير منفَّذة — لا تُعرض كميزات)

- بحث نصي مباشر داخل `/knowledge-base` بجانب التصفح بالفئات.
- أرشفة المحادثات بدل الحذف فقط.
- تصدير المحادثة كملف.
- تكامل مع مجلدات سحابية (Drive/SharePoint) للرفع التلقائي.
- تقارير شهرية بالبريد لمدير الشركة.
- تسجيل دخول موحّد (SSO).

## آلية التحقق بعد إعادة التصميم

1. لكل جدول أعلاه: املأ «الموقع الجديد» و«يعمل؟» يدويًا بعد تجربة فعلية بحساب موظف وحساب مدير.
2. شغّل `npm test` و`tests/sql/run-isolation-tests.sh`؛ يجب أن تبقى الأرقام: وحدة ٦٩٧ ناجحًا | SQL ٢٤٥/٢٤٥ | طفرات ٤٥ فاشلة.
3. قارن قائمة الإجراءات: `grep -rhoE "export async function \w+Action" src/app | sort` يجب أن تُعطي ٥١ إجراءً نفسها.
4. قارن المسارات: `find src/app -name page.tsx -o -name route.ts` يجب ألا يقل عن ٥٤ ملفًا.
5. تأكد أن لا شاشة تعرض ميزة من §٠.
