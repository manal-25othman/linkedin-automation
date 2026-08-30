#!/usr/bin/env bash
#
# تدقيق تطابق الشيفرة مع الترحيلات.
#
#   npm run schema-audit
#
# يبني قاعدة نظيفة من `supabase/ALL_MIGRATIONS.sql` — الملف الذي يُلصق
# فعلًا في محرّر Supabase — ثم يتحقّق أن **كل** جدول ودالّة وعمود تناديه
# الشيفرة موجود فيه.
#
# ---------------------------------------------------------------------
# لماذا هذا الفحص
#
# الترحيلة تُكتب في ملف والشيفرة تُكتب في آخر، ولا رابط بينهما يفرض
# التطابق. فيُضاف عمود في الشيفرة ويُنسى في الترحيلة، أو تُكتب ترحيلة
# ولا تدخل الحزمة المولّدة.
#
# ولا يظهر الخلل في البناء ولا في الأنواع ولا في أي اختبار وحدة: كلّها
# تقرأ `database.ts` وهو **وصفٌ يدويّ** لا القاعدة نفسها. فيظهر عند أول
# مستخدم، رسالةً غامضة عن SQL — وقد ظهر فعلًا.
#
# والحزمة هي المفحوصة لا مجلّد الترحيلات: ما يُشغَّل على الإنتاج هو
# الحزمة، وترحيلةٌ صحيحة لم تدخلها لا وجود لها عمليًّا.
# ---------------------------------------------------------------------

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${AUDIT_DB:-ma3rifah_schema_audit}"
PSQL=(psql -v ON_ERROR_STOP=1 -q)

echo "▸ بناء قاعدة نظيفة من الحزمة: $DB"
"${PSQL[@]}" -d postgres -c "drop database if exists $DB;" >/dev/null
"${PSQL[@]}" -d postgres -c "create database $DB;" >/dev/null
"${PSQL[@]}" -d "$DB" -f "$ROOT/tests/sql/00_supabase_shim.sql" >/dev/null 2>&1
"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/ALL_MIGRATIONS.sql" >/dev/null 2>&1

failures=0

# --------------------------------------------------- إعادة التشغيل
#
# الحزمة تُلصق في محرّر Supabase، وتُلصق **أكثر من مرّة**: ترحيلةٌ جديدة
# تُضاف فتُعاد كلها، أو يُعاد التشغيل بعد انقطاع.
#
# و`create or replace function` لا يغيّر نوع الإرجاع. فإن وسّعت ترحيلةٌ
# لاحقة دالّةً عرّفتها سابقة، سقط التشغيل الثاني عند **الأقدم** لا
# الأحدث — ورسالتُه تشير إلى دالّة لم يمسّها أحد، فيضلّ التشخيص.
#
# وقد وقع هذا فعلًا عند مستخدمة، ولم يكشفه بناءٌ نظيف واحد.
echo "▸ الحزمة تُعاد بلا خطأ"
rerun_errors=$("${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/ALL_MIGRATIONS.sql" 2>&1 | grep -cE "ERROR" || true)
if [ "$rerun_errors" != "0" ]; then
  echo "  ✗ إعادة تشغيل الحزمة تُخرج $rerun_errors خطأ" >&2
  "${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/ALL_MIGRATIONS.sql" 2>&1 | grep -E "ERROR|HINT" | head -6 >&2
  failures=$((failures + 1))
fi

report() {
  echo "  ✗ $1"
  failures=$((failures + 1))
}

# --------------------------------------------------------------- الجداول
echo "▸ الجداول التي تناديها الشيفرة"
grep -rhoE "\.from\('([a-z_]+)'\)" --include=\*.ts --include=\*.tsx "$ROOT/src" \
  | sed "s/\.from('//; s/')//" | sort -u | while read -r table; do
  [ -z "$table" ] && continue
  found=$("${PSQL[@]}" -d "$DB" -Atc \
    "select count(*) from information_schema.tables
     where table_schema='public' and table_name='$table'")
  if [ "$found" = "0" ]; then echo "MISSING_TABLE $table"; fi
done > /tmp/schema_audit_tables.txt

# --------------------------------------------------------------- الدوالّ
echo "▸ الدوالّ التي تناديها الشيفرة"
grep -rhoE "\.rpc\('([a-z_]+)'" --include=\*.ts --include=\*.tsx "$ROOT/src" \
  | sed "s/\.rpc('//; s/'//" | sort -u | while read -r fn; do
  [ -z "$fn" ] && continue
  found=$("${PSQL[@]}" -d "$DB" -Atc \
    "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.proname='$fn'")
  if [ "$found" = "0" ]; then echo "MISSING_FUNCTION $fn"; fi
done > /tmp/schema_audit_functions.txt

# --------------------------------------------------------------- الأعمدة
echo "▸ الأعمدة المعلَنة في database.ts"
python3 - "$ROOT" > /tmp/schema_audit_columns_wanted.txt <<'PY'
import re, sys, pathlib
root = pathlib.Path(sys.argv[1])
src = (root / 'src/types/database.ts').read_text(encoding='utf-8')

tables = dict(re.findall(r'(\w+):\s*Table<(\w+)>', src))
by_type = {v: k for k, v in tables.items()}

for match in re.finditer(r'type (\w+Row) = \{(.*?)\n\};', src, re.S):
    table = by_type.get(match.group(1))
    if not table:
        continue
    for line in match.group(2).split('\n'):
        column = re.match(r'^\s*([a-z_]+)\??:', line)
        if column:
            print(f"{table}\t{column.group(1)}")
PY

while IFS=$'\t' read -r table column; do
  [ -z "$table" ] && continue
  found=$("${PSQL[@]}" -d "$DB" -Atc \
    "select count(*) from information_schema.columns
     where table_schema='public' and table_name='$table' and column_name='$column'")
  if [ "$found" = "0" ]; then echo "MISSING_COLUMN $table.$column"; fi
done < /tmp/schema_audit_columns_wanted.txt > /tmp/schema_audit_columns.txt

# --------------------------------------------------------------- النتيجة
echo
for file in /tmp/schema_audit_tables.txt /tmp/schema_audit_functions.txt /tmp/schema_audit_columns.txt; do
  while read -r line; do
    [ -n "$line" ] && report "$line"
  done < "$file"
done

tables_n=$(grep -rhoE "\.from\('([a-z_]+)'\)" --include=\*.ts --include=\*.tsx "$ROOT/src" | sort -u | wc -l)
funcs_n=$(grep -rhoE "\.rpc\('([a-z_]+)'" --include=\*.ts --include=\*.tsx "$ROOT/src" | sort -u | wc -l)
cols_n=$(wc -l < /tmp/schema_audit_columns_wanted.txt)

echo "فُحص: $tables_n جدولًا · $funcs_n دالّة · $cols_n عمودًا"

if [ "$failures" -gt 0 ]; then
  echo "✗ الحزمة لا تطابق الشيفرة — $failures اختلافًا" >&2
  echo "  الأرجح: ترحيلة كُتبت ولم تُضَف إلى الحزمة. شغّلي: npm run db:bundle" >&2
  exit 1
fi

echo "✓ الحزمة تطابق الشيفرة تمامًا"
