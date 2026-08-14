ALTER TABLE public.class_messages REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;