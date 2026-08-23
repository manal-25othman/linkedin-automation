---
name: لانغ غراف
nameLatin: LangGraph
slug: langgraph
description: مكتبة لبناء الوكلاء كرسم بياني ذي حالة، بحلقات وشروط ونقاط توقّف لمراجعة بشرية.
category: agent-frameworks
license: open-source
hosting: both
website: https://www.langchain.com/langgraph
docs: https://langchain-ai.github.io/langgraph/
repo: https://github.com/langchain-ai/langgraph
goodFor:
  - مسارات تحتاج حلقات وتفرّعات لا خطًّا مستقيمًا
  - إيقاف التنفيذ لانتظار موافقة بشرية
  - الحاجة إلى حفظ الحالة واستئنافها
limits:
  - نموذج الرسم البياني يستلزم وقت تعلّم
  - سهولة بناء حلقات يعني سهولة بناء حلقات لا تنتهي
relatedArticles:
  - llm-agents-production
  - multi-agent-systems
published: 2026-08-23
---

بناء الوكلاء كرسم بياني ذي حالة: حلقات وشروط ونقطة توقّف للمراجعة البشرية قبل الفعل.

## ما الذي تقدّمه

الفكرة المركزية أن الوكيل ليس سلسلة بل آلة حالات. لانغ غراف يجعل الحالة والانتقالات صريحة، فتستطيع حفظ التنفيذ واستئنافه، وإدراج نقطة توقّف تنتظر موافقة إنسان قبل خطوة حسّاسة.

هذه النقطة تحديدًا هي ما يفصل وكيلًا صالحًا للإنتاج عن عرضٍ توضيحي.

## ملاحظة تشغيلية

ضع حدًّا أعلى لعدد الخطوات وميزانية للاستدعاءات في كل تنفيذ. الوكيل بلا سقف يتحوّل إلى فاتورة مفتوحة عند أول حلقة غير متوقّعة.

## المراجع

- [الموقع الرسمي](https://www.langchain.com/langgraph)
- [التوثيق](https://langchain-ai.github.io/langgraph/)
- [المستودع](https://github.com/langchain-ai/langgraph)
