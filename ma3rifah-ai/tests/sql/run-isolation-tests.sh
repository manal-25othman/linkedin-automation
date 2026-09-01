#!/usr/bin/env bash
#
# تشغيل اختبارات العزل على قاعدة PostgreSQL حقيقية.
#
#   ./tests/sql/run-isolation-tests.sh
#
# يبني قاعدة اختبار نظيفة، يطبّق عليها ملفات supabase/migrations كما هي،
# يزرع بيانات شركتين، ثم ينفّذ الاختبارات بدور authenticated فتخضع لـRLS
# تمامًا كطلبات المستخدمين عبر PostgREST. يخرج بحالة غير صفرية إن فشل أي
# اختبار، فيصلح للاستخدام في CI.
#
# متغيرات البيئة:
#   PGHOST / PGPORT / PGUSER   إعدادات الاتصال (افتراضيًا محلية)
#   TEST_DB                    اسم قاعدة الاختبار (تُحذف وتُعاد إنشاؤها)
#   SKIP_SHIM=1                تخطّي طبقة المحاكاة (استخدمه مع Supabase حقيقي
#                              حيث auth/storage موجودان أصلًا)
#   MUTATE=1                   شاهد سلبي: يعطّل حرّاس العزل ثم يشغّل
#                              الاختبارات، ويتوقع فشلها. يثبت أن الاختبارات
#                              تكشف الثغرة فعلًا ولا تنجح بالمصادفة.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_DB="${TEST_DB:-ma3rifah_test}"
PSQL_BASE=(psql -v ON_ERROR_STOP=1 -q)

run_sql() { "${PSQL_BASE[@]}" -d "$TEST_DB" "$@"; }

echo "▸ إعادة إنشاء قاعدة الاختبار: $TEST_DB"
"${PSQL_BASE[@]}" -d postgres -c "drop database if exists $TEST_DB;" >/dev/null
"${PSQL_BASE[@]}" -d postgres -c "create database $TEST_DB;" >/dev/null

if [[ "${SKIP_SHIM:-0}" != "1" ]]; then
  echo "▸ تطبيق طبقة محاكاة Supabase"
  run_sql -f "$ROOT/tests/sql/00_supabase_shim.sql" >/dev/null 2>&1
fi

echo "▸ تطبيق ملفات الهجرة"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  if run_sql -f "$migration" >/dev/null 2>&1; then
    echo "  ✓ $(basename "$migration")"
  else
    echo "  ✗ $(basename "$migration")" >&2
    run_sql -f "$migration" >/dev/null || true
    exit 1
  fi
done

echo "▸ زرع بيانات الشركتين"
run_sql -f "$ROOT/tests/sql/01_isolation_fixtures.sql" >/dev/null

if [[ "${MUTATE:-0}" == "1" ]]; then
  echo "▸ الشاهد السلبي: تعطيل حرّاس العزل عمدًا"
  run_sql -f "$ROOT/tests/sql/90_mutation.sql" >/dev/null
fi

echo "▸ تنفيذ الاختبارات بدور authenticated"
run_sql -f "$ROOT/tests/sql/02_isolation_tests.sql" >/dev/null

echo "▸ اختبارات العدّاد المشترك لتحديد المعدّل"
run_sql -f "$ROOT/tests/sql/03_rate_limit_tests.sql" >/dev/null

echo "▸ اختبارات التقرير المالي"
run_sql -f "$ROOT/tests/sql/04_finance_tests.sql" >/dev/null

echo "▸ اختبارات رموز الدعوة"
run_sql -f "$ROOT/tests/sql/05_invite_tests.sql" >/dev/null

echo "▸ اختبارات الاسترجاع الهجين"
run_sql -f "$ROOT/tests/sql/06_hybrid_retrieval_tests.sql" >/dev/null

echo "▸ اختبارات جودة الفهرسة"
run_sql -f "$ROOT/tests/sql/07_index_quality_tests.sql" >/dev/null

echo "▸ اختبارات عزل المالك"
run_sql -f "$ROOT/tests/sql/08_owner_isolation_tests.sql" >/dev/null

echo
"${PSQL_BASE[@]}" -d "$TEST_DB" -P pager=off -c "
  select id as \"#\",
         case when passed then 'PASS' else 'FAIL' end as \"النتيجة\",
         category as \"الفئة\", name as \"الاختبار\", detail as \"التفصيل\"
  from public.test_results order by id;"

read -r total passed failed <<<"$(
  "${PSQL_BASE[@]}" -d "$TEST_DB" -Atc \
    "select count(*), count(*) filter (where passed), count(*) filter (where not passed)
     from public.test_results;" | tr '|' ' '
)"

echo
echo "الإجمالي: $total · ناجح: $passed · فاشل: $failed"

if [[ "${MUTATE:-0}" == "1" ]]; then
  if (( failed > 0 )); then
    echo "✓ الشاهد السلبي صحيح: الاختبارات كشفت الثغرة المزروعة ($failed فشل)"
    exit 0
  fi
  echo "✗ الشاهد السلبي فشل: الاختبارات لم تكشف الثغرة المزروعة" >&2
  exit 1
fi

if (( failed > 0 )); then
  echo "✗ فشلت اختبارات أمنية — لا يجوز النشر" >&2
  exit 1
fi

echo "✓ كل اختبارات العزل والصلاحيات نجحت"
