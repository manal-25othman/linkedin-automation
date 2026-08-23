-- =====================================================================
-- 0025 — إعادة تسعير الخطط
--
-- التسعير الأول كان يخسر. الحساب:
--
--   النموذج الافتراضي `claude-opus-5` بسقف خرج 8000 ⇒ السؤال ≈ 0.068$
--   وخطة Starter تبيع 5000 سؤال بـ499 ريالًا (133$) ⇒ التكلفة 340$
--
-- أي أن **العميل الأكثر استعمالًا هو الأكثر خسارةً** — وهو انقلابٌ في
-- نموذج العمل لا مسألة تحسين. ورفعُ السعر بعد توقيع العقود أصعب بكثير
-- من ضبطه قبلها، فالتصحيح يسبق أول عميل لا يتبعه.
--
-- وثلاثة تغييرات معًا:
--
--   1. الأسعار ترتفع إلى ~80 ريالًا لكل مستخدم. والعشرة ريالات السابقة
--      لا تُقرأ كرمًا بل شكًّا في القيمة: منافسنا يبيع بـ20–75 دولارًا.
--
--   2. الحصص تنكمش إلى ما يُبلَغ فعلًا (60–80 سؤالًا للموظف شهريًا =
--      3–4 يوميًا). والحصة التي لا تُبلَغ أبدًا لا تبيع ترقية، وهي كل
--      فائدة وجودها.
--
--   3. تُضاف خطة وسطى (Growth) — والقفزة من 899 إلى 5999 مباشرةً تترك
--      الشركة المتوسطة بلا ما يناسبها.
--
-- وحدّ المستندات ليس لتغطية تكلفة: فهرسة المستند تكلّف 0.0007$ فقط.
-- وجوده لتقسيم الخطط وإعطاء سببٍ للترقية.
--
-- والتحديث بالرمز (code) لا بالمعرّف، وبـupdate لا بحذفٍ وإنشاء: الخطة
-- المحذوفة تكسر كل اشتراك يشير إليها.
-- =====================================================================

update public.plans set
  price_amount          = 899.00,
  description           = 'للفرق الصغيرة التي تبدأ توثيق معرفتها.',
  max_users             = 10,
  max_documents         = 50,
  max_questions_monthly = 600,
  max_storage_mb        = 5120,
  features = '["مساعد ذكي بالعربية والإنجليزية","إجابات موثّقة بالمصدر والصفحة","التحقق من الأرقام ودرجة الثقة","فجوات المعرفة","صلاحيات على مستوى المستند","سجل تدقيق","دعم عبر البريد خلال يوم عمل"]'::jsonb,
  sort_order = 1
where code = 'STARTER';

insert into public.plans
  (code, name, description, price_amount, currency, billing_interval,
   max_users, max_documents, max_questions_monthly, max_storage_mb,
   features, is_public, is_custom_priced, sort_order)
values
  ('GROWTH', 'Growth',
   'الأنسب للشركات التي يسأل فريقها يوميًا.',
   2499.00, 'SAR', 'MONTHLY',
   30, 200, 2000, 25600,
   '["كل مزايا Starter","تحليلات متقدمة والنشاط حسب القسم","مساعد واتساب","أولوية في الدعم خلال 4 ساعات","تقارير جودة الإجابات"]'::jsonb,
   true, false, 2)
on conflict (code) do update set
  name                  = excluded.name,
  description           = excluded.description,
  price_amount          = excluded.price_amount,
  max_users             = excluded.max_users,
  max_documents         = excluded.max_documents,
  max_questions_monthly = excluded.max_questions_monthly,
  max_storage_mb        = excluded.max_storage_mb,
  features              = excluded.features,
  is_public             = excluded.is_public,
  sort_order            = excluded.sort_order;

update public.plans set
  price_amount          = 5999.00,
  description           = 'للمؤسسات التي تحتاج ضوابط وصولٍ ومستوى خدمة.',
  max_users             = 75,
  max_documents         = 600,
  max_questions_monthly = 6000,
  max_storage_mb        = 102400,
  features = '["كل مزايا Growth","الدخول الموحّد (SSO)","تقرير عزل موقّع لفريق الأمن","اتفاقية مستوى خدمة 99.5%","مدير حساب مخصّص"]'::jsonb,
  sort_order = 3
where code = 'BUSINESS';

update public.plans set
  description = 'للمؤسسات الكبيرة ذات المتطلبات الخاصة.',
  features = '["كل مزايا Business","عدد مستخدمين غير محدود","مفتاح ذكاء اصطناعي خاص بالعميل (BYOK)","تكاملات مخصصة","خيارات استضافة خاصة"]'::jsonb,
  sort_order = 4
where code = 'ENTERPRISE';
