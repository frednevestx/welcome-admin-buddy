
CREATE POLICY "support attach read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'support-attachments' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')
  ));

CREATE POLICY "support attach insert own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-attachments' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')
  ));

CREATE POLICY "support attach delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'support-attachments' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')
  ));
