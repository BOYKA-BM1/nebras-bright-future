-- Content protection security events + Egyptian payment methods seed
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT where possible

-- ===== Content protection events =====
CREATE TABLE IF NOT EXISTS public.content_protection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NULL REFERENCES public.courses(id) ON DELETE SET NULL,
  lesson_id uuid NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'screenshot_detected',
    'screen_recording_detected',
    'capture_attempt_suspected',
    'protected_content_visibility_changed'
  )),
  detection_method text NOT NULL DEFAULT 'browser_signal',
  confidence text NOT NULL DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high', 'confirmed_native')),
  platform text NULL,
  user_agent text NULL,
  session_note text NULL,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'reviewed', 'dismissed')),
  admin_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpe_user ON public.content_protection_events(user_id);
CREATE INDEX IF NOT EXISTS idx_cpe_created ON public.content_protection_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpe_status ON public.content_protection_events(review_status);

ALTER TABLE public.content_protection_events ENABLE ROW LEVEL SECURITY;

-- Students can insert their own events only
DROP POLICY IF EXISTS "cpe_insert_own" ON public.content_protection_events;
CREATE POLICY "cpe_insert_own" ON public.content_protection_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can read/update all (via has_role)
DROP POLICY IF EXISTS "cpe_admin_select" ON public.content_protection_events;
CREATE POLICY "cpe_admin_select" ON public.content_protection_events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'admin_secondary')
    OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "cpe_admin_update" ON public.content_protection_events;
CREATE POLICY "cpe_admin_update" ON public.content_protection_events
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'admin_secondary')
  );

-- ===== Payment methods seed (4 Egyptian methods) =====
-- Assumes payment_methods has unique key on "key" or "id"
INSERT INTO public.payment_methods (key, label, number, instructions, is_active, sort_order)
VALUES
  ('instapay', 'InstaPay', NULL, 'حوّل عبر InstaPay بالمبلغ المطلوب ثم ارفق رقم العملية أو صورة الإيصال.', true, 1),
  ('vodafone_cash', 'فودافون كاش', NULL, 'حوّل عبر فودافون كاش ثم ارفق رقم العملية وصورة الإيصال.', true, 2),
  ('etisalat_cash', 'اتصالات كاش', NULL, 'حوّل عبر اتصالات كاش ثم ارفق رقم العملية وصورة الإيصال.', true, 3),
  ('fawry', 'فوري', NULL, 'ادفع عبر فوري ثم أدخل رقم العملية وأرفق الإيصال إن وُجد.', true, 4)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  instructions = EXCLUDED.instructions,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;
