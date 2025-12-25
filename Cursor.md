# Cabinet — Cursor Project Spec (Fake Government)

## What this project is

Cabinet is a web app that turns daily planning + reflection into a fun “cabinet meeting”.
The user submits: goals, constraints, and values. Multiple AI ministers (agents) give distinct advice and vote.
A Prime Minister agent synthesizes 2–3 actionable plans. The user chooses, and the system logs outcomes.

This must feel like a “fake cabinet”: ministers have roles, personalities, and disagree on principle.
User is sovereign: agents advise, never decide.

---

## Product Goals (MVP)

1. Magic-link login (Supabase Auth).
2. Dashboard: recent briefs + “Start Morning Brief”.
3. Morning Brief form: goals, constraints, values -> “Call the Cabinet”.
4. Cabinet Chamber page: minister cards + PM summary + votes + choose plan.
5. Save decision and run Evening Audit.
6. Model-per-agent configuration (provider/model/temp per minister).
7. Deployable on Netlify. Secrets server-side only.

Non-goals for MVP: calendar/email integrations, tool-use agents, multi-user teams, complicated debate graphs.

---

## Tech stack

Frontend:

- Next.js (App Router), TypeScript, Tailwind, shadcn/ui
- Framer Motion optional for meeting animations

Backend:

- Netlify Functions for AI calls + DB writes (server-only)

Data/Auth:

- Supabase Auth (magic link)
- Supabase Postgres with RLS

LLM:

- OpenAI API (MVP)
- Architecture must allow adding other providers later by implementing a provider adapter.

---

## Required UX (make it fun)

- Cabinet Chamber UI looks like a “meeting”: ministers arranged around a table (grid).
- Clicking a minister opens a “dossier” dialog with full response + vote + model config.
- Prime Minister summary is centered as “Cabinet Brief”.
- Opposition Leader visually separated (different styling).

---

## Data model (Supabase tables)

All rows must be scoped to the logged-in user (user_id) and enforced with RLS.

Tables:

- profiles(id=auth.users.id, display_name, timezone, created_at)
- cabinet_members(id, user_id, name, role, system_prompt, model_provider, model_name, temperature, is_enabled, created_at)
- briefs(id, user_id, title, input_context jsonb, status queued|running|done|failed, created_at)
- brief_responses(id, brief_id, cabinet_member_id, response_text, vote approve|abstain|oppose, metadata jsonb, created_at)
- decisions(id, brief_id, chosen_option, user_notes, created_at)
- audits(id, brief_id, reflection, what_changed, created_at)

---

## Default Cabinet (seed on first login)

Seed these 6 ministers if user has none:

- Prime Minister (Synthesizer)
- Minister of Productivity
- Minister of Ethics
- Minister of Philosophy
- Minister of Economy (Opportunity Cost)
- Opposition Leader (Skeptic)

Each must have a strong system prompt and consistent output format:

- Recommendation
- Tradeoffs
- Risks
- One hard question
- Vote (approve/abstain/oppose) + one-line reason

---

## Orchestration rules (server-side)

When creating a brief:

1. Insert into briefs(status=running)
2. Load enabled cabinet members from DB
3. Call each minister in parallel (Promise.all)
4. Save each to brief_responses
5. Call Prime Minister last using original context + all minister outputs
6. Save PM output as a special brief_response row (or a separate field, but prefer brief_responses for consistency)
7. Update briefs(status=done)

Hard requirements:

- Never call LLM from client.
- Never expose service role key or OpenAI key to client.
- Every function must verify Supabase JWT (Authorization header).
- Timeouts + retries should be minimal but present (e.g., 1 retry).
- Persist model metadata (model, latency) in brief_responses.metadata.

---

## Bias / fairness experiments (MVP+ but code-ready)

We want model-per-agent to reduce single-model bias and create real disagreement.
Later add /evals page that runs the same scenario across different model configs.
Store eval results in a table if needed.

---

## Repository structure (target)

- src/app for pages
- src/components for UI
- src/lib for supabase + agents
- netlify/functions for server endpoints
- supabase/migrations for SQL

---

## Cursor implementation contract (how Cursor should work on this repo)

When asked to implement a feature:

1. First: scan the repo and summarize current state (what already exists and what doesn’t).
2. Second: propose a minimal plan (small set of file edits).
3. Third: implement in small commits (few files at a time), with no breaking changes.

Quality gates:

- No secrets in client.
- Typescript types for payloads.
- Clean UI with shadcn components.
- Avoid overengineering frameworks for agents.
- Keep orchestrator simple and readable.

---

## Environment variables

Local and Netlify:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
  Server only:
- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY

---

## Acceptance checklist (MVP)

- Login works (magic link)
- Cabinet members exist automatically after first login
- Create brief -> cabinet responses appear
- Choose plan -> decision saved
- Evening audit saved
- Deployed on Netlify using server functions (no secret leaks)
