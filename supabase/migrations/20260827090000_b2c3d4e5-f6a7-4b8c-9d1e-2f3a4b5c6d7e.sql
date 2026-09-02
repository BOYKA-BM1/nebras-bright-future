-- Must be its own migration: PostgreSQL forbids using a newly-added enum value
-- inside the same transaction that added it. Every later migration that
-- references 'parent' depends on this one having already been committed.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parent';
