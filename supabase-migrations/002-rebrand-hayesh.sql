-- ============================================================
-- MIGRATION 002 — Rebrand: platform is "Hayesh" (hayesh.com)
-- Updates the AI-services brand name seeded by the original
-- schema. Run once in the Supabase SQL Editor.
-- ============================================================

update public.platform_settings
set value = '"HayeshAI Studio"'::jsonb
where key = 'ai_service_brand_name';
