ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer_service';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secretary';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'montage';

ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS profit_percentage numeric(5,2) NOT NULL DEFAULT 50;