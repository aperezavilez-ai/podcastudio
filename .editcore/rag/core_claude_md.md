# core:CLAUDE.md

Fecha de ingesta: 2026-10-13T15:03:58.006Z
Fuente: D:\PROGRAMAS IA\PODCASTUDIO\CLAUDE.md
Tags: core, auto-ingest

# GAFCORE Ecosystem & Infrastructure Guidelines

## ⚠️ CRITICAL RULE FOR AI
**DO NOT use official Supabase Cloud (`https://*.supabase.co`).**
All projects in this workspace use the **GAFCORE Self-Hosted Ecosystem ($0/month)**.

* **Public Supabase URL:** `https://supabase.gafcore.com`
* **Local Kong API:** `http://127.0.0.1:54321`
* **Direct PostgreSQL:** `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
* **Supabase Studio UI:** `http://localhost:54323`
* **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRheGlkcml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3OTMwMDQsImV4cCI6MjEwNjE1MzAwNH0.tP1IWgKG3pimuIW_oIrCsTf9PKjiOrU1ulVcq-9Btl0`
* **Service Role Key:** `<SUPABASE_SERVICE_ROLE_KEY en .env.local>`

### Project Structure:
1. Every project must have a `project-infra.json` specifying its dedicated database schema.
2. Store SQL migrations in `supabase/migrations/`.
3. Apply SQL migrations into the dedicated schema in the local Postgres instance.

