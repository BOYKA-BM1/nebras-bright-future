-- =========================================================================
-- REALTIME NOTIFICATIONS
-- Same pattern already used for class_messages/psych_messages in this
-- project: enable full replica identity + add the table to the realtime
-- publication so postgres_changes events fire on INSERT/UPDATE.
-- =========================================================================

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
