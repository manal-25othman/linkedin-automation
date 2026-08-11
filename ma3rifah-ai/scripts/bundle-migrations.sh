#!/usr/bin/env bash
#
# يدمج ملفات supabase/migrations/*.sql في ملف واحد يُلصق مرة واحدة في
# Supabase SQL Editor، بدل تنفيذ أحد عشر ملفًا بالترتيب يدويًا.
#
#   npm run db:bundle
#
# الملف الناتج مولَّد — لا يُحرَّر يدويًا. أعد توليده بعد أي تغيير في
# مجلد الهجرات حتى لا ينحرف عن مصدره.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/supabase/ALL_MIGRATIONS.sql"

{
  echo "-- ============================================================"
  echo "-- معرفة AI — كل الهجرات في ملف واحد"
  echo "-- مولَّد من supabase/migrations/*.sql بـ: npm run db:bundle"
  echo "-- لا تحرّر هذا الملف يدويًا — عدّل الهجرة الأصلية وأعد التوليد."
  echo "--"
  echo "-- الاستخدام: الصق محتواه كاملًا في Supabase SQL Editor ونفّذه."
  echo "-- آمن لإعادة التنفيذ (idempotent)."
  echo "-- ============================================================"
  echo
  for migration in "$ROOT"/supabase/migrations/*.sql; do
    echo "-- ═══════════════════════════════════════════════════════════"
    echo "-- $(basename "$migration")"
    echo "-- ═══════════════════════════════════════════════════════════"
    cat "$migration"
    echo
  done
} > "$OUT"

echo "✓ $(basename "$OUT") — $(wc -l < "$OUT") سطرًا من $(ls -1 "$ROOT"/supabase/migrations/*.sql | wc -l) ملفات"
