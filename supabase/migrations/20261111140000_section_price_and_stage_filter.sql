ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS price integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.sections.price IS 'سعر الوحدة منفردة بالجنيه؛ 0 = غير متاح للشراء المنفرد أو مجاني مع الكامل';

-- ربط طلب الدفع بوحدة اختيارية
ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL;
