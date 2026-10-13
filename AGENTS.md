# GAFCORE Ecosystem & Infrastructure Guidelines

## ⚠️ CRITICAL RULE FOR ALL AI AGENTS (Antigravity, Cursor, Claude, GafCoreAI, Copilot)
**DO NOT use official Supabase Cloud (`https://*.supabase.co`) or create paid cloud infrastructure.**
All projects in this workspace use the **GAFCORE Self-Hosted Ecosystem ($0/month)**.

---

## 1. Backend & Supabase Configuration
Whenever creating, configuring, or connecting a Supabase backend for ANY project in `D:\PROGRAMAS IA\`:

* **Public Supabase URL:** `https://supabase.gafcore.com`
* **Local Supabase API (Kong):** `http://127.0.0.1:54321`
* **Direct PostgreSQL Connection:** `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
* **Supabase Studio UI:** `http://localhost:54323`
* **Public Anon Key:**
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRheGlkcml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3OTMwMDQsImV4cCI6MjEwNjE1MzAwNH0.tP1IWgKG3pimuIW_oIrCsTf9PKjiOrU1ulVcq-9Btl0`
* **Service Role Key:**
  `<SUPABASE_SERVICE_ROLE_KEY en .env.local>`

---

## 2. Project Isolation & Schema Architecture
Every project must be strictly isolated to avoid mixing data:

1. **`project-infra.json` (Required in every project root):**
   ```json
   {
     "version": 1,
     "projectName": "<Project Name>",
     "projectSlug": "<project-slug>",
     "isolationMode": "dedicated_supabase",
     "supabase": {
       "url": "https://supabase.gafcore.com",
       "schema": "<project_slug>"
     }
   }
   ```
2. **Dedicated PostgreSQL Schema:**
   - Each project has its own schema: `schema: <project_slug>` (e.g., `taxidriv`, `gymnastica`, `calili`, `iarestaurant`).
   - Tables for that project must be created within its dedicated schema or registered in PostgREST exposed schemas.
3. **Environment Files (`.env`, `.env.local`):**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://supabase.gafcore.com
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRheGlkcml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3OTMwMDQsImV4cCI6MjEwNjE1MzAwNH0.tP1IWgKG3pimuIW_oIrCsTf9PKjiOrU1ulVcq-9Btl0
   ```

---

## 3. Creating a New Project Checklist
When the user asks to create or initialize a project:
1. Create project folder in `D:\PROGRAMAS IA\<PROJECT_NAME>\`.
2. Generate `project-infra.json` with the assigned `schema`.
3. Create `.env` and `.env.local` with `https://supabase.gafcore.com` and the GAFCORE keys.
4. Put migration files in `supabase/migrations/`.
5. Apply SQL tables to the local database at `127.0.0.1:54322` under the project schema.
6. The GAFCORE Projects Hub ([http://localhost:4000](http://localhost:4000)) will automatically register the project.

---

## 4. Security & Backups
* Never hardcode sensitive secrets in public client files.
* Backups and dumps are stored in `D:\PROGRAMAS IA\Z RESPALDOS\`.
