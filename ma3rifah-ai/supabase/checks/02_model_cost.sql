-- =====================================================================
-- أيّ نموذج يعمل فعلًا، وبكم
-- =====================================================================
-- الافتراض في الشيفرة `claude-sonnet-5`، لكن متغيّر البيئة يغلبه.
-- ومن نسخ `.env.example` قبل ٣١ أغسطس ٢٠٢٦ نسخ `claude-opus-5` —
-- وهو ما تُحسب معه الخطط خاسرةً عند الاستهلاك الكامل.
--
-- فإن ظهر `opus` أدناه، غيّر `ANTHROPIC_MODEL` في Vercel وأعد النشر.
-- =====================================================================
select
  model                                              as "النموذج",
  operation                                          as "العملية",
  count(*)                                           as "الاستدعاءات",
  round(avg(output_tokens))                          as "متوسط رموز الخرج",
  round(sum(estimated_cost_usd)::numeric, 4)         as "التكلفة $",
  round(avg(estimated_cost_usd)::numeric, 5)         as "لكل استدعاء $"
from public.ai_usage_logs
where created_at >= now() - interval '30 days'
group by model, operation
order by count(*) desc;
