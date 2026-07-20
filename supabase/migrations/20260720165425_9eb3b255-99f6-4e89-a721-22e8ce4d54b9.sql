
CREATE POLICY "Owners manage own restaurant avatars"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'restaurant-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'restaurant-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated read restaurant avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'restaurant-avatars');
