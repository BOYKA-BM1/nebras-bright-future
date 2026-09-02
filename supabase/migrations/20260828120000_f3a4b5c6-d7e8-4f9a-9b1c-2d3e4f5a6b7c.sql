-- =========================================================================
-- NOTIFICATION PREFERENCES
-- One row per user; missing row = all-enabled default (no forced opt-in
-- migration needed for existing users). Enforcement happens in a single
-- BEFORE INSERT trigger on notifications — returning NULL silently skips
-- the insert, so none of the existing notify_* trigger functions need to
-- change at all.
--
-- 'admin' type notifications (see send_admin_broadcast) are DELIBERATELY
-- never gated here — those are the "security/necessary" notifications the
-- phase spec explicitly says must stay non-disableable, since an admin
-- chose to broadcast them platform-wide.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  course_enabled boolean NOT NULL DEFAULT true,
  exam_enabled boolean NOT NULL DEFAULT true,
  assignment_enabled boolean NOT NULL DEFAULT true,
  montage_enabled boolean NOT NULL DEFAULT true,
  -- المفتاح الرئيسي لكل إشعارات ولي الأمر (نتائج/تقدّم/شهادات أبنائه) —
  -- ولي الأمر مالوش دورات/امتحانات خاصة بيه في المنصة، فأي إشعار course/exam/
  -- assignment بيوصله هو أصلًا إشعار عن ابنه، فبيتحكم فيه بالمفتاح ده بدل
  -- التفصيل الفرعي.
  parent_digest_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification prefs own" ON public.notification_preferences;
CREATE POLICY "notification prefs own" ON public.notification_preferences FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_notification_prefs_updated BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.check_notification_preference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_parent boolean;
  _pref record;
BEGIN
  IF NEW.type = 'admin' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _pref FROM public.notification_preferences WHERE user_id = NEW.user_id;
  IF NOT FOUND THEN
    RETURN NEW; -- لا توجد تفضيلات محفوظة = الإعداد الافتراضي (الكل مفعّل)
  END IF;

  _is_parent := EXISTS (SELECT 1 FROM public.parent_children WHERE parent_user_id = NEW.user_id AND status = 'active');

  IF _is_parent AND NEW.type IN ('course', 'exam', 'assignment') THEN
    IF NOT _pref.parent_digest_enabled THEN RETURN NULL; END IF;
    RETURN NEW;
  END IF;

  IF NEW.type = 'course' AND NOT _pref.course_enabled THEN RETURN NULL; END IF;
  IF NEW.type = 'exam' AND NOT _pref.exam_enabled THEN RETURN NULL; END IF;
  IF NEW.type = 'assignment' AND NOT _pref.assignment_enabled THEN RETURN NULL; END IF;
  IF NEW.type = 'montage' AND NOT _pref.montage_enabled THEN RETURN NULL; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_notification_preference ON public.notifications;
CREATE TRIGGER trg_check_notification_preference BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.check_notification_preference();

REVOKE ALL ON FUNCTION public.check_notification_preference() FROM PUBLIC, anon, authenticated;
