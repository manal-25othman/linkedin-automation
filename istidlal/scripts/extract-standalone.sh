#!/usr/bin/env bash
# يستخرج مشروع استدلال إلى مستودع مستقلّ، بتاريخه، وبمسارات مصحّحة.
#
# الاستعمال (من جذر المستودع الحالي):
#   bash istidlal/scripts/extract-standalone.sh ../istidlal-site
#
# ثم ادفع المجلّد الناتج إلى مستودع GitHub جديد وفارغ.

set -euo pipefail

TARGET="${1:-../istidlal-site}"
PREFIX="istidlal"
SOURCE_ROOT="$(pwd)"
TMP_BRANCH="istidlal-standalone-$$"

if [ ! -d "$PREFIX" ]; then
  echo "✗ شغّل الأمر من جذر المستودع الذي يحوي مجلّد $PREFIX." >&2
  exit 1
fi

if [ -e "$TARGET" ]; then
  echo "✗ المسار $TARGET موجود مسبقًا. اختر مسارًا جديدًا." >&2
  exit 1
fi

echo "▸ استخراج تاريخ $PREFIX…"
git subtree split --prefix="$PREFIX" --branch "$TMP_BRANCH" >/dev/null

echo "▸ إنشاء المستودع الجديد في $TARGET…"
git clone --quiet --no-local --single-branch --branch "$TMP_BRANCH" . "$TARGET"
git branch -D "$TMP_BRANCH" >/dev/null

cd "$TARGET"
git branch -m "$TMP_BRANCH" main
git remote remove origin

# إعدادات المحرّر تنتقل إلى الجذر، ومساراتها تفقد بادئة المجلّد القديم.
echo "▸ ضبط .pages.yml على المسارات الجديدة…"
if [ -f "$SOURCE_ROOT/.pages.yml" ]; then
  sed 's|istidlal/||g' "$SOURCE_ROOT/.pages.yml" > .pages.yml
else
  echo "⚠︎ لم يُعثر على .pages.yml في المستودع الأصلي — انسخه يدويًّا وأزل بادئة istidlal/ من مساراته."
fi

git add .pages.yml
git -c user.email="$(git config user.email || echo dev@localhost)" \
    -c user.name="$(git config user.name || echo dev)" \
    commit --quiet -m "نقل إعدادات المحرّر إلى جذر المستودع المستقلّ" || true

cat <<DONE

✓ جاهز في $TARGET
  الكوميتات: $(git rev-list --count HEAD)
  الفرع: main

الخطوات التالية:
  1) أنشئ مستودعًا فارغًا جديدًا على GitHub (بلا README ولا .gitignore).
  2) cd $TARGET
     git remote add origin git@github.com:<اسمك>/<المستودع>.git
     git push -u origin main
  3) في Vercel: Root Directory = . (الجذر) بدل istidlal
  4) في .pages.yml و docs: حدّث اسم المستودع إن ذُكر.
DONE
