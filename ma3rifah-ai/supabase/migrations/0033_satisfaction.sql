-- =====================================================================
-- مقياس الرضا لمالك المنصّة
-- =====================================================================
-- التقييم (إبهام مرفوع/مخفوض) موجود منذ 0004، وعمود `feedback_note`
-- موجود معه — ولم يُكتب فيه شيء قطّ: لم تكن الواجهة تسأل عن السبب.
--
-- فصار الرقم يقول «كم غير راضٍ» ولا يقول **لماذا**، وهو أنفع ما فيه.
--
-- ملاحظة خصوصية مهمّة:
-- السبب نصٌّ يكتبه موظفٌ في شركةٍ عميلة عن مستند شركته. وعرضُه لمالك
-- المنصّة تجاوزٌ لحدّ العزل المطبَّق في كل ما عداه — وهو مقصود هنا
-- ومحدود: لا يُعرض نصّ السؤال ولا نصّ الإجابة ولا اسم الكاتب، بل
-- السبب وحده مع اسم الشركة والتاريخ. والواجهة تُخبر الكاتب قبل أن
-- يكتب أن ما يكتبه يصل إلى فريق المنصة.
-- =====================================================================

create or replace function public.platform_satisfaction(p_days integer default 30)
returns table (
  total_rated    bigint,
  up_count       bigint,
  down_count     bigint,
  satisfaction   numeric,
  notes_count    bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select
    count(*) filter (where m.feedback is not null),
    count(*) filter (where m.feedback = 'UP'),
    count(*) filter (where m.feedback = 'DOWN'),
    case
      when count(*) filter (where m.feedback is not null) = 0 then null
      else round(
        100.0 * count(*) filter (where m.feedback = 'UP')
        / count(*) filter (where m.feedback is not null), 1)
    end,
    count(*) filter (where m.feedback_note is not null and btrim(m.feedback_note) <> '')
  from public.messages m
  where m.role = 'ASSISTANT'
    and m.created_at >= now() - make_interval(days => greatest(p_days, 1));
end;
$$;

-- أسباب عدم الرضا — بلا سؤالٍ ولا إجابةٍ ولا اسم كاتب
create or replace function public.platform_feedback_notes(p_limit integer default 50)
returns table (
  note         text,
  company_name text,
  created_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select m.feedback_note, c.name, m.created_at
  from public.messages m
  join public.conversations v on v.id = m.conversation_id
  join public.companies c on c.id = v.company_id
  where m.role = 'ASSISTANT'
    and m.feedback = 'DOWN'
    and m.feedback_note is not null
    and btrim(m.feedback_note) <> ''
  order by m.created_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

revoke all on function public.platform_satisfaction(integer) from public, anon;
revoke all on function public.platform_feedback_notes(integer) from public, anon;
grant execute on function public.platform_satisfaction(integer) to authenticated;
grant execute on function public.platform_feedback_notes(integer) to authenticated;
