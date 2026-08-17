# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this repository actually is

Despite the name, `linkedin-automation` holds **three unrelated projects** side by side. There is no root `package.json`, no workspace tooling, and no shared code between them. Always work inside one project directory at a time and never assume a change in one affects another.

| Path | What it is | Tech |
|---|---|---|
| `workflows/` + `templates/` + root `README.md` | The LinkedIn automation itself — a single n8n workflow JSON plus a Google Sheet CSV template. **No code, no build step.** | n8n |
| `ma3rifah-ai/` | «معرفة AI» — multi-tenant RAG SaaS: company documents → cited answers. The most complex project here. | Next.js 15 · Supabase/Postgres + pgvector · Claude API · Vitest |
| `jamalik/` | «جمالِك» — Arabic beauty magazine with an admin CMS, SEO, and ads/analytics integrations. | Next.js 16 · Prisma 6 + Postgres · custom auth · Playwright script |

Dependencies are **not** installed in a fresh clone. `npm install` inside the project directory you are touching (Node 20+; the sandbox runs Node 22).

## Cross-cutting conventions

These hold across both apps — follow them rather than importing habits from a generic Next.js codebase.

- **Arabic is the default language of this repo.** UI strings, code comments, JSDoc, documentation, and **git commit messages** are written in Arabic. Match the surrounding file. Identifiers, file names, DB columns, and env var names stay in English.
- **RTL-first layout.** Use Tailwind logical properties (`ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`), never `pl-`/`pr-`/`left-`/`right-`.
- **Comments explain *why*, not *what*.** Existing comments justify a decision ("the middleware can't reach the DB, so the real check lives in `requireUser`"). Do not add narration comments that restate the code.
- **Secrets never reach the client.** Server-only modules start with `import 'server-only'`. Anything `NEXT_PUBLIC_*` is public by definition — a service key or secret API key in such a var is a bug, not a style issue.
- **Defence in depth is deliberate.** Middleware is an early gate, never the authorization check; the real check runs where data is read (`requirePermission` / `requireUser`) *and*, in `ma3rifah-ai`, again in the database via RLS. Don't "simplify" by removing a layer.
- **User-facing errors are Arabic, human, and detail-free.** No stack traces, no PostgREST codes, no internal identifiers surfaced to users.
- **Strict TypeScript**, `@/*` → `src/*` in both apps. No `any` escapes to work around a type error.
- `.env.example` in each project is the source of truth for env vars; keep it updated when adding one, with an Arabic comment explaining the variable and its failure mode.

### Before you commit (in whichever project you touched)

```bash
npm run lint && npm run typecheck && npm run build
npm run test          # ma3rifah-ai only (Vitest)
```

Both projects treat a clean lint + typecheck + build as the baseline. Report honestly if something fails rather than working around it.

### Git

- Commit messages in Arabic, imperative/descriptive, one concern per commit — e.g. `فرض حدود الخطة: المستخدمون والمستندات والتخزين`.
- Work on the designated feature branch; push with `git push -u origin <branch>`.
- Do not open a PR unless explicitly asked.

---

## `ma3rifah-ai/` — multi-tenant knowledge assistant

Read `ma3rifah-ai/README.md` for setup, and `docs/SRS.md` + `docs/SETUP-CHECKLIST.md` for product and deployment detail.

### Commands

```bash
npm run dev            # http://localhost:3000
npm run lint           # eslint .
npm run typecheck
npm run test           # Vitest (unit + integration)
npm run build

npm run db:bundle      # regenerate supabase/ALL_MIGRATIONS.sql — REQUIRED after any migration change
npm run db:seed        # demo company with real ingestion pipeline
npm run db:reset       # destructive re-seed — never against production
npm run test:isolation         # RLS isolation suite on a real Postgres (needs pgvector)
npm run test:isolation:mutate  # negative control: plants a hole, expects failures
npm run injection-drill        # prompt-injection drill against the live model
```

### Architecture

```
Browser (App Router, RTL)
   ├─ Server Components ──► Supabase client (user session) ──► RLS ──► Postgres + pgvector
   └─ Server Actions ─────► lib/ services (rag · ai · billing · whatsapp · audit)
```

- `src/app/` route groups: `(marketing)` public site, `(auth)`, `(dashboard)` company workspace, `admin/` platform-owner console, `api/` route handlers (`health`, `site-chat`, `whatsapp/webhook`, `webhooks/moyasar`).
- `src/lib/` is where logic lives; pages are thin. Server Actions sit next to the page they serve in `actions.ts`.
- `src/lib/rag/`: extract → chunk → embed → retrieve → ingest, plus `verify.ts` and `curated-answer.ts`.
- `src/lib/ai/`: `claude.ts` (client), `prompts.ts` (system prompt), `chat-service.ts`, `usage.ts` (cost logging).
- `supabase/migrations/` is the schema of record — currently `0001`…`0021`, applied in numeric order.

### Non-negotiable invariants

1. **Tenant isolation lives in the database, not the app.** Every table has RLS keyed off `company_id` derived from `auth.uid()` inside Postgres. Never "fix" a missing-row bug by switching to the admin client.
2. **Three Supabase clients, three purposes.** `lib/supabase/server.ts` (user session, RLS-bound — the default), `client.ts` (browser), `admin.ts` (service role, **bypasses RLS**). Every admin-client call must be preceded by an explicit permission check and explicit `company_id` scoping, because the database will not protect you there.
3. **`match_document_chunks` never accepts a company id from the caller.** It derives company, role, and department itself and filters forbidden chunks *before* similarity scoring. `seed_match_chunks` does take one — which is why it is granted to `service_role` only. Do not widen that grant.
4. **The "no answer" sentence is load-bearing.** `prompts.ts` forces a fixed Arabic phrase when sources are insufficient; it is string-matched to record a knowledge gap. Changing the wording requires updating `NO_ANSWER_PATTERNS` in the same file.
5. **`EMBEDDINGS_DIMENSIONS` must match the `vector(N)` column** (`1024` by default). Changing one without the other silently breaks retrieval — the README documents the full migration path.
6. **After editing `supabase/migrations/`, run `npm run db:bundle`.** `ALL_MIGRATIONS.sql` is generated, idempotent, and must not be hand-edited; letting it drift from its source is a real deployment failure mode.
7. **Every Server Action follows the same shape:** `requirePermission(...)` → zod parse (`lib/validation/schemas.ts`) → mutate → `recordAudit(...)` → `revalidatePath(...)` → return `{ ok, message }`. Errors are caught and mapped through `toAppError`. Copy this shape rather than inventing a new one.

### Tests

`tests/unit/` (17 Vitest files: chunking, rbac, embeddings, retrieval selection, PDF runtime, moyasar, whatsapp, prompt injection, …), `tests/integration/tenant-isolation.test.ts` (via PostgREST — **auto-skips without Supabase env vars**, so run it with a real project before shipping), and `tests/sql/` (42 RLS assertions against a plain Postgres + pgvector, no keys needed, CI-friendly). `server-only` is aliased to a stub in `vitest.config.ts`.

The mutation run (`test:isolation:mutate`) is the point: a suite that passes but does not fail when a hole is planted proves nothing.

### Known gaps

Rate limiting is in-memory (per instance — swap the store in `lib/rate-limit.ts` for multi-instance deploys). Document ingestion runs in the server process. English UI strings are componentized but no translation files exist. Scanned PDFs need OCR before upload (detected and reported, not silently failed).

### Doc drift to watch

`ma3rifah-ai/README.md` still describes an 11-migration schema and does not cover WhatsApp, support tickets, notifications, plan-limit enforcement, or Moyasar payments — all of which exist in the code (`0012`–`0021`). Trust the migrations and `src/`, and prefer updating the README when you touch these areas.

---

## `jamalik/` — Arabic beauty magazine + CMS

Read `jamalik/README.md`, and `jamalik/PROJECT_AUDIT.md` for the architecture/security/perf review and the pre-launch checklist.

**Note:** `jamalik/CLAUDE.md` is a one-line import of `jamalik/AGENTS.md`, which is auto-generated and re-added by `next dev`. It warns that Next.js 16 differs from older training data — **read `jamalik/node_modules/next/dist/docs/` before writing Next.js code in this project**, and commit that block alongside your work rather than deleting it.

### Commands

```bash
npm run dev
npm run lint / typecheck / build      # build runs `prisma generate` first
npm run db:migrate / db:deploy / db:seed / db:studio / db:reset
npm run test:e2e                      # needs a running server + E2E_ADMIN_* env vars
npm run placeholders                  # regenerate SVG placeholder images
```

`vercel-build` (`prisma migrate deploy && prisma generate && node scripts/vercel-seed.mjs && next build`) is what Vercel runs — migrations and conditional seeding happen inside the build, so no manual deploy commands.

### Architecture

- `src/app/(site)/` public magazine, `src/app/admin/(dashboard)/` CMS behind `requireUser`, `src/app/admin/login/` deliberately outside the guard.
- `src/app/actions/` holds Server Actions split by domain (`admin-articles`, `admin-taxonomy`, `admin-settings`, `public-forms`, `auth`).
- `src/lib/queries/` is the only place Prisma queries live for reads; `publishedWhere()` is the single definition of "published" (scheduled articles become visible by time, with no cron job).
- `src/features/archive/` shares list logic between `/articles` and `/articles/page/[number]`-style routes.
- `src/lib/seo/` (metadata, JSON-LD schema, in-editor SEO audit), `src/lib/markdown.ts` (unified/remark/rehype with `rehype-sanitize`).
- Auth is bespoke: bcryptjs + signed server-side sessions (`jose`), cookie `jamalik_session`.

### Invariants

1. **`requireUser()` / `requireAdmin()` at the top of every admin page and every admin Server Action.** The middleware only checks that the cookie exists.
2. **Two database URLs, on purpose.** `DATABASE_URL` = transaction pooler (+ `?pgbouncer=true&connection_limit=1`) for runtime; `DIRECT_URL` = session pooler for migrations and seeding, because transaction pooling cannot run DDL. Most deploy failures trace back to swapping these.
3. **Form state is shared via `src/lib/form-state.ts`**, kept out of `"use server"` files — those may only export async functions, so a constant exported from one arrives as `undefined` on the client.
4. **Markdown content never uses `#`.** The article title is the page's only H1; the editor's SEO audit rejects it. Supported: `##`/`###`, lists, tables, links, images, and `:::tip` / `:::note` / `:::warning` directives.
5. **Seeding rewrites article content.** `RUN_SEED` is a one-shot deploy variable that must be removed after the first successful deploy or editorial changes get wiped on every rebuild.
6. **Third-party integrations are opt-in.** No GA, AdSense, or newsletter script loads unless a valid ID is configured; DB settings take precedence over env values.

---

## `workflows/` — the n8n LinkedIn automation

`workflows/linkedin-daily-post.json` is a six-node n8n workflow: schedule (09:00) → Google Sheets read (`Status = Pending`) → Limit 1 → IF non-empty → LinkedIn post → Sheets update to `Posted`. `templates/google-sheet-template.csv` is the sheet structure (`Date`, `PostText`, `Status`) with sample Arabic posts.

When editing it:

- Keep the placeholders `YOUR_GOOGLE_SHEET_ID` and `YOUR_LINKEDIN_PERSON_ID` — the file is meant to be imported and configured, not pre-filled with anyone's IDs.
- Column names must stay English; expressions reference `$json.PostText` and the `Mark as Posted` node matches on `row_number` from the node named `Take One Post`. **Renaming nodes breaks the expressions.**
- The JSON is hand-maintained; keep node ids, the Arabic sticky-note instructions, and the root `README.md` walkthrough in sync with any structural change.
- No Python, no scripts, no scraping — everything runs through official n8n nodes and LinkedIn's Share API. Keep it that way.
