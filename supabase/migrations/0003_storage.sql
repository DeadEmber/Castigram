-- ============================================================================
-- Castigram · Almacenamiento de imágenes
-- Un bucket público para fotos de bandos, muro y mercadillo.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Cualquiera puede ver las imágenes (bucket público).
create policy "media_public_read"
  on storage.objects for select
  using (bucket_id = 'media');

-- Solo usuarios registrados pueden subir, y cada uno a su propia carpeta
-- (media/<user_id>/...). Esto evita que se pisen o borren archivos ajenos.
create policy "media_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "media_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "media_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
