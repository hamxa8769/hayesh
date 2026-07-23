-- ============================================================
-- MIGRATION 014 — account holder name on saved payment methods
--
-- Mobile wallets (Easypaisa, JazzCash) and NayaPay/bank transfers need the
-- ACCOUNT HOLDER'S NAME, not just the number — an admin verifying or
-- reconciling a transfer has to see whose account it is. That name is PII but
-- not a secret like the account number, and it must be READABLE by the admin
-- in the clear, so it lives in its own plaintext column rather than inside the
-- AES-256-GCM-encrypted account_reference blob.
--
-- Run once in the Supabase SQL Editor. Idempotent / re-runnable.
-- ============================================================

alter table public.payment_methods
  add column if not exists account_holder_name text;

-- The owner may write this column on their own rows. payment_methods already
-- grants the owner full control of their rows (migration 011), and no earlier
-- migration revoked column-level INSERT/UPDATE here, so no extra grant is
-- needed — this note is just to record that the owner-writable surface is
-- intentional and admins remain read-only on other users' payment methods.
