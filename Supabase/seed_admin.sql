-- ============================================================
-- VeriSync — Seed an administrator account
--
-- Run this AFTER Supabase/schema.sql, and AFTER the target user
-- has signed up through the app (their profile row must exist).
--
-- HOW TO USE:
--   1. Replace the email below with the account to promote.
--   2. Run this script in the Supabase SQL Editor.
-- ============================================================

update public.profiles
set
  role = 'administrator',
  status = 'approved'
where email = 'admin@example.com';  -- <-- change this

-- Verify the change:
-- select id, email, role, status from public.profiles where role = 'administrator';
