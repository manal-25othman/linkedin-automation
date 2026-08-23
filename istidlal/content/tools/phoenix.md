---
name: فينيكس
nameLatin: Arize Phoenix
slug: phoenix
description: أداة رصد وتتبّع مفتوحة المصدر: تعرض أثر كل استدعاء ومقاطعه المسترجَعة وتكلفته وكمونه.
category: evaluation
license: open-source
hosting: both
website: https://phoenix.arize.com
docs: https://arize.com/docs/phoenix
repo: https://github.com/Arize-ai/phoenix
goodFor:
  - تشخيص سبب إجابة سيّئة عبر أثر التنفيذ كاملًا
  - رصد الكمون والتكلفة لكل خطوة
  - تقييم على بيانات إنتاج حقيقية لا تجريبية
limits:
  - يتطلّب تجهيز التتبّع (OpenTelemetry) في الكود
  - الرصد يضيف حملًا يجب حسابه في أنظمة عالية المعدّل
relatedArticles:
  - latency-metrics
  - hallucination-measurement
  - rag-complete-guide
published: 2026-08-23
---

رصد وتتبّع مفتوح المصدر لأنظمة النماذج: أثر كامل لكل استدعاء، بمقاطعه وتكلفته وكمونه.

## ما الذي تقدّمه

التصحيح بلا أثر تنفيذ تخمين. فينيكس يعرض ما استُرجع فعلًا، وما أُرسل إلى النموذج، وكم استغرقت كل خطوة وكم كلّفت — وهي المعلومات الأربع التي تُغلق أغلب بلاغات «الإجابة خاطئة».

يعتمد OpenTelemetry، فيتكامل مع رصدك القائم بدل أن يستبدله.

## ملاحظة تشغيلية

اربط معرّف الأثر برقم بلاغ المستخدم. البلاغ الذي يصحبه أثر يُحلّ في دقائق، والبلاغ المجرّد يُحلّ في أيام أو لا يُحلّ.

## المراجع

- [الموقع الرسمي](https://phoenix.arize.com)
- [التوثيق](https://arize.com/docs/phoenix)
- [المستودع](https://github.com/Arize-ai/phoenix)
