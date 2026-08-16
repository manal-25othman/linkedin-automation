# دليل الضبط — خطوة بخطوة

دليل تشغيلي لضبط المنصة على بيئة حقيقية. مرتّب بحيث لا تحتاج خطوةٌ ما بعدها،
فيمكن التوقف عند أي نقطة والعودة لاحقًا.

الوقت التقريبي: ٤٥ دقيقة، عدا ما ينتظر جهة خارجية (السجل التجاري، توثيق النطاق).

---

## ١) قاعدة البيانات — ترحيلات SQL

**المكان:** Supabase ← مشروعك ← SQL Editor ← New query

**ما تفعلينه:** افتحي ملف `supabase/ALL_MIGRATIONS.sql` من المستودع، انسخيه
كاملًا، والصقيه، ثم **Run**.

الملف آمن للتكرار: تشغيله مرة أو ثلاثًا يعطي النتيجة نفسها. مُختبَر على
PostgreSQL 16 من قاعدة جديدة ومن قاعدة قائمة، وفي الحالتين ثلاث جولات
متتالية بلا خطأ.

**للتحقق أنه نجح** — الصقي هذا وشغّليه:

```sql
select
  (select count(*) from pg_proc where proname = 'check_user_quota')                   as "حد المستخدمين",
  (select count(*) from pg_proc where proname = 'check_storage_quota')                as "حد التخزين",
  (select count(*) from pg_proc where proname = 'activate_subscription_for_payment')  as "تفعيل الاشتراك",
  (select count(*) from pg_tables where tablename = 'payments')                       as "جدول المدفوعات",
  (select case when indpred is null then 'كامل ✓' else 'جزئي ✗' end
     from pg_index i join pg_class c on c.oid = i.indexrelid
    where c.relname = 'notifications_unique_event_idx')                               as "فهرس التنبيهات";
```

المطلوب: أربعة أرقام قيمتها ١، وفهرس التنبيهات **كامل**. لو ظهر «جزئي» فلن
يصل أي تنبيه — أعيدي تشغيل الملف.

---

## ٢) روابط الدخول والبريد

**Supabase ← Authentication ← URL Configuration**

| الحقل | القيمة |
|---|---|
| Site URL | `https://ma3rifah-ai.vercel.app` |
| Redirect URLs | `https://ma3rifah-ai.vercel.app/auth/callback` |

بدون سطر `Redirect URLs` تقول كل روابط البريد «انتهت الصلاحية» وهي جديدة.

**Vercel ← Settings ← Environment Variables**

```
NEXT_PUBLIC_APP_URL=https://ma3rifah-ai.vercel.app
```

> أي تغيير في متغيرات Vercel يحتاج **Redeploy** ليسري. التغيير وحده لا يكفي.

---

## ٣) البريد — إخراج الرسائل من مجلد المزعج

الرسائل الآن تُرسَل من نطاق مشترك، فتصل في «المزعج». الحل الدائم نطاق موثَّق:

1. Resend ← Domains ← Add Domain ← أدخلي نطاقك
2. أضيفي سجلات DNS التي تعرضها (SPF و DKIM) عند مزوّد نطاقك
3. انتظري التوثيق (دقائق إلى ساعات)
4. Supabase ← Authentication ← Emails ← SMTP Settings ← غيّري
   `Sender email` إلى بريد على نطاقك الموثَّق

**اختياري لكنه مفيد:** قوالب البريد في Supabase إنجليزية افتراضيًا. من
Authentication ← Email Templates يمكن تعريبها — خصوصًا «Reset Password»،
لأنها القالب الذي يصل الموظف الجديد ليضع كلمة مروره، و«Reset your password»
عنوانٌ مربك لمن لم يكن له حساب أصلًا.

---

## ٤) بوابة الدفع — Moyasar

### أ) الحساب والمفاتيح

1. سجّلي في [moyasar.com](https://moyasar.com)
2. Settings ← API Keys — ستجدين زوجين: **Test** و **Live**
3. ابدئي بمفاتيح **Test**: تعمل ببطاقات وهمية ولا تحتاج سجلًا تجاريًا

### ب) متغيرات Vercel

```
MOYASAR_SECRET_KEY=sk_test_xxxxxxxxxxxx
NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxx
MOYASAR_WEBHOOK_SECRET=<نصّ عشوائي طويل تختارينه أنتِ>
```

> ⚠ المفتاح السري (`sk_`) لا يوضع أبدًا في متغير يبدأ بـ`NEXT_PUBLIC_` —
> فذلك يرسله إلى متصفح كل زائر.

`MOYASAR_WEBHOOK_SECRET` قيمة تخترعينها أنتِ (٣٢ حرفًا عشوائيًا مثلًا)،
وتكتبينها في موضعين: هنا، وفي لوحة Moyasar بالخطوة التالية. لا بد أن
تتطابقا حرفًا بحرف.

### ج) الـwebhook

Moyasar ← Webhooks ← Add:

| الحقل | القيمة |
|---|---|
| URL | `https://ma3rifah-ai.vercel.app/api/webhooks/moyasar` |
| Events | `payment_paid` و `payment_failed` |
| Secret token | القيمة نفسها من `MOYASAR_WEBHOOK_SECRET` |

ثم **Redeploy** في Vercel.

### د) التجربة

الاشتراك والفواتير ← اختاري خطة ← «الاشتراك في هذه الخطة» ← ادفعي ببطاقة
الاختبار التي تعرضها Moyasar في وثائقها.

المتوقع: تعودين إلى الصفحة برسالة «تم استلام الدفعة وتفعيل اشتراكك»، وتظهر
الدفعة في «سجلّ المدفوعات»، وتتغيّر الخطة الحالية.

**المنصة تعمل بلا هذه المفاتيح.** تظهر رسالة أن البوابة غير مفعّلة، ولا
يتعطّل شيء آخر — فلا داعي لتأجيل بقية الخطوات.

---

## ٥) الصفحتان القانونيتان

`/privacy` و `/terms` جاهزتان نصًّا، وتعرضان تنبيهًا ظاهرًا أنهما مسوّدة حتى
تُضبط بيانات الكيان النظامي:

```
NEXT_PUBLIC_LEGAL_NAME=الاسم النظامي كما في السجل التجاري
NEXT_PUBLIC_LEGAL_CR=رقم السجل التجاري
NEXT_PUBLIC_LEGAL_VAT=الرقم الضريبي
NEXT_PUBLIC_LEGAL_ADDRESS=العنوان الوطني
NEXT_PUBLIC_LEGAL_EMAIL=بريد التواصل النظامي
```

النصّ صياغة تقنية لما تفعله المنصة فعلًا، **وليس استشارة قانونية**. اعرضيه
على مختص نظامي قبل أول عميل يدفع.

---

## ٦) قبل أول عميل يدفع

| البند | لماذا |
|---|---|
| **Supabase Pro** | النسخة المجانية توقف قاعدة البيانات عند الخمول وبلا نسخ احتياطي. عميل يدفع لا يجوز أن يكون عليها. |
| **نطاق مخصّص** | `vercel.app` في العنوان يُضعف الثقة في عرض B2B. |
| **الفاتورة الضريبية ١٥٪** | إلزامية نظامًا. لم تُبنَ بعد. |
| **رفع PDF عربي** | أُصلحت ثلاث علل فيه ولم يُختبر على بيئتك. |
| **اختبارات العزل الـ١٦** | تحتاج قاعدة بيانات حيّة لتشغيلها. |

---

## ملحق — ترتيب ما يعتمد على ماذا

```
الترحيلات (١)
  ├── حدود الخطط تعمل
  ├── التنبيهات تصل
  └── جدول المدفوعات جاهز
        └── بوابة الدفع (٤)  ←  تحتاج مفاتيح Moyasar فقط
                                  (والسجل التجاري لاستلام المال، لا للاختبار)

روابط الدخول (٢)
  └── دعوة الموظفين واستعادة كلمة المرور تعملان
        └── توثيق النطاق (٣) يُخرجها من مجلد المزعج
```
