-- =====================================================================
-- 0001 — الامتدادات المطلوبة
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- pgvector: البحث الدلالي عبر المتجهات
create extension if not exists "vector";

-- pg_trgm: البحث النصي التقريبي (يستخدم في البحث الهجين وفي فحص تشابه الأسئلة)
create extension if not exists "pg_trgm";

-- unaccent: تطبيع النصوص العربية/اللاتينية عند البحث
create extension if not exists "unaccent";
