# CURSOR_SPEC.md — Cabinet (Fake Government) Web App

## 0) One-liner

Build a web app called **Cabinet**: a fun “fake government” that runs daily cabinet meetings. The user enters goals/constraints/values, multiple AI “ministers” (agents) give competing advice, then a Prime Minister synthesizes options, ministers vote, and the user chooses. The system stores history and supports swapping different models per minister to compare personalities and reduce single-model bias.

---

## 1) Primary Goals (MVP)

1. **Morning Brief**: user enters daily context; app generates multi-agent advice.
2. **Cabinet Chamber UI**: ministers appear as cards around a “table”; each gives advice + vote.
3. **Decision logging**: user picks a plan; store decision + notes.
4. **Evening Audit**: simple reflection; Opposition agent highlights rationalizations.
5. **Model-per-agent**: each minister has its own model/provider/temperature.
6. **Deployable**: Netlify + Supabase with secrets server-side.

---

## 2) Non-Goals (for MVP)

- No complex tool use (calendar/email) yet.
- No multi-user collaboration features.
- No heavy agent frameworks (LangGraph) in MVP; implement a simple orchestrator.

---

## 3) Tech Stack

### Frontend

- Next.js (App Router), TypeScript, Tailwind
- shadcn/ui components
- Framer Motion (nice-to-have for “meeting start” animation)

### Backend

- Netlify Functions for server-side AI calls + DB writes
- OpenAI Responses API for LLM calls (server-side only)

### Database/Auth

- Supabase Auth (magic link email)
- Supabase Postgres with Row Level Security (RLS)

---

## 4) Core UX Pages

1. `/login`
   - email magic link
2. `/` Dashboard
   - “Start Morning Brief”
   - recent briefs list
3. `/brief/new`
   - form: goals, constraints, values
   - button: “Call the Cabinet”
4. `/brief/[id]`
   - Cabinet Chamber UI
   - minister cards + Prime Minister summary
   - voting panel + “Choose Plan”
   - “Evening Audit” button
5. `/cabinet`
   - enable/disable ministers
   - configure model/provider/temp per minister
6. `/evals` (MVP+)
   - run the same scenario across different models & temps and compare outputs

---

## 5) Data Model (Supabase tables)

All tables are user-scoped with `user_id` and RLS.

### `profiles`

- id (uuid pk, references auth.users)
- display_name text
- timezone text
- created_at timestamptz

### `cabinet_members`

- id uuid pk
- user_id uuid fk
- name text
- role text // e.g. "productivity", "ethics"
- system_prompt text
- model_provider text // "openai" (MVP), later "anthropic", "local"
- model_name text // e.g. "gpt-4.1-mini" etc.
- temperature float
- is_enabled boolean
- created_at timestamptz

### `briefs`

- id uuid pk
- user_id uuid fk
- title text
- input_context jsonb // {goals, constraints, values}
- status text // queued|running|done|failed
- created_at timestamptz

### `brief_responses`

- id uuid pk
- brief_id uuid fk
- cabinet_member_id uuid fk
- response_text text
- vote text // approve|abstain|oppose
- metadata jsonb // {model, latency_ms, tokens}
- created_at timestamptz

### `decisions`

- id uuid pk
- brief_id uuid fk
- chosen_option text
- user_notes text
- created_at timestamptz

### `audits`

- id uuid pk
- brief_id uuid fk
- reflection text
- what_changed text
- created_at timestamptz

---

## 6) Repository File Structure

Use this structure (Cursor should create missing files):

cabinet/
netlify.toml
src/
app/
layout.tsx
globals.css
login/page.tsx
page.tsx
brief/
new/page.tsx
[id]/page.tsx
cabinet/page.tsx
components/
cabinet/
MinisterCard.tsx
CabinetTable.tsx
VotePanel.tsx
BriefSummary.tsx
common/
Navbar.tsx
LoadingState.tsx
lib/
supabase/
client.ts
server.ts
auth.ts
db/
queries.ts
agents/
types.ts
prompts/
defaultMinisters.ts
modelRouter.ts
orchestrator.ts
safety.ts
netlify/
functions/
briefs-create.ts
briefs-get.ts
briefs-decide.ts
briefs-audit.ts

supabase/
migrations/
001_init.sql
seed.sql

---

## 7) Agent System (MVP behavior)

### Ministers (default set)

- Prime Minister (Synthesizer)
- Minister of Productivity
- Minister of Ethics
- Minister of Philosophy
- Minister of Economy (Opportunity Cost)
- Opposition Leader (Skeptic)

### Orchestration rules

1. For a new brief:
   - Load enabled ministers from DB
   - Call LLM for each minister in parallel
   - Save `brief_responses`
2. Then call Prime Minister:
   - Input: all minister outputs + original user context
   - Output: 2-3 plan options + tradeoffs + suggested votes
3. Votes:
   - Each minister outputs a `vote` field and 1-line justification
4. Safety:
   - Run a lightweight “safety check” function that blocks/flags obviously harmful guidance.

### Model-per-agent

- Each `cabinet_member` uses its own {provider, model, temperature}
- MVP supports OpenAI only, but code is structured to add more providers later.

---

## 8) API / Server Functions (Netlify)

All functions must:

- Verify Supabase JWT from Authorization header
- Use Supabase service role key server-side only
- Never expose AI keys to client

### POST /.netlify/functions/briefs-create

Body:
{
"title": "Thursday Plan",
"input_context": { "goals": "...", "constraints": "...", "values": ["health","family"] }
}

Behavior:

- Insert into `briefs` (status=running)
- Orchestrate ministers + Prime Minister
- Insert into `brief_responses`
- Update `briefs.status=done`
- Return brief id

### GET /.netlify/functions/briefs-get?id=...

- Return brief + responses + decision + audit

### POST /.netlify/functions/briefs-decide

Body: { "brief_id": "...", "chosen_option": "...", "user_notes": "..." }

### POST /.netlify/functions/briefs-audit

Body: { "brief_id": "...", "reflection": "...", "what_changed": "..." }

---

## 9) UI Requirements (Cabinet Chamber)

- Minister cards arranged in a “table” layout (grid).
- Click a minister card -> opens dialog “dossier”:
  - name, role
  - model config (read-only)
  - full response
- Center panel:
  - Prime Minister summary (options)
- Vote panel:
  - display each minister’s vote
  - user chooses plan and saves decision

---

## 10) Implementation Order (Cursor should follow)

### Phase 1: Infrastructure

1. Create Supabase clients (client.ts/server.ts)
2. Build login page using magic link
3. Build auth guard for protected routes
4. Add placeholder dashboard

### Phase 2: Database & Seeding

1. Add SQL migration: tables + RLS
2. On first login:
   - create profile row
   - seed default cabinet_members if none exist

### Phase 3: Morning Brief + Orchestrator

1. Build /brief/new form
2. Implement briefs-create function
3. Implement orchestrator + modelRouter + default prompts
4. Save responses and show /brief/[id]

### Phase 4: Decision + Audit

1. Decision endpoint + UI
2. Audit endpoint + UI

### Phase 5: Cabinet Builder

1. /cabinet page to edit ministers model/temp and enable/disable
2. Persist to DB

---

## 11) Environment Variables

Local `.env.local` and Netlify env vars:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server only)
- OPENAI_API_KEY (server only)

---

## 12) Cursor Instructions (what Cursor should do)

When implementing:

- Keep the code simple and readable.
- Prefer small modules over frameworks.
- Use TypeScript types for API payloads and DB entities.
- Avoid blocking UI; show loading states.
- Write minimal error handling with clear messages.
- Do not write secrets into the client.
- Ensure RLS is enforced (queries must always filter by user_id).
- Provide clean, consistent styling (shadcn + Tailwind).

Deliverables Cursor must generate:

1. Supabase migration SQL + RLS policies
2. Supabase client/server wrappers
3. Login flow + session management
4. Full MVP routes/pages and Netlify functions
5. Default minister prompts + orchestrator

---

## 13) Definition of Done (MVP)

- I can login with magic link.
- I can create a morning brief.
- I see 6 ministers + Prime Minister summary + votes.
- I can choose a plan and save it.
- I can run an evening audit.
- I can configure models per minister.
- Deployed on Netlify with Supabase backend.
