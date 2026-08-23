---
name: غاردريلز إيه‌آي
nameLatin: Guardrails AI
slug: guardrails-ai
description: إطار للتحقّق من مخرجات النموذج قبل تسليمها: مخطَّط، ومحتوى، وقواعد قابلة للتعريف.
category: security
license: open-source
hosting: self-hosted
website: https://www.guardrailsai.com
docs: https://www.guardrailsai.com/docs
repo: https://github.com/guardrails-ai/guardrails
goodFor:
  - فرض مخطَّط صارم على مخرجات النموذج
  - حجب أنماط محدّدة قبل وصولها للمستخدم
  - إعادة المحاولة تلقائيًّا عند فشل التحقّق
limits:
  - التحقّق يمنع المخرجات السيّئة المعروفة لا المجهولة
  - كل طبقة تحقّق تضيف كمونًا
relatedArticles:
  - owasp-llm-top10
  - prompt-injection-defense
  - tool-calling-schemas
published: 2026-08-23
---

طبقة تحقّق على مخرجات النموذج: مخطَّط وقواعد تُطبَّق قبل أن يرى المستخدم الإجابة.

## ما الذي تقدّمه

المبدأ الصحيح أن مخرج النموذج مُدخل غير موثوق. غاردريلز يجعل ذلك عمليًّا: تعرّف المخطَّط والقواعد، ويُرفض ما لا يطابقها أو يُعاد طلبه.

هذا لا يغني عن التعقيم عند العرض، لكنه يمنع فئة كاملة من الأعطال: الحقول الناقصة، والأنواع الخاطئة، والصيغ غير القابلة للتحليل.

## ملاحظة تشغيلية

التحقّق حاجز لا ضمان. أبقِ التعقيم عند نقطة العرض قائمًا مهما بلغت ثقتك في طبقة التحقّق.

## المراجع

- [الموقع الرسمي](https://www.guardrailsai.com)
- [التوثيق](https://www.guardrailsai.com/docs)
- [المستودع](https://github.com/guardrails-ai/guardrails)
