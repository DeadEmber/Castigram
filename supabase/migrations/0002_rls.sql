-- ============================================================================
-- Castigram · Row Level Security (RLS)
-- Reglas de quién puede leer y escribir cada cosa.
-- ============================================================================

alter table public.profiles      enable row level security;
alter table public.bandos        enable row level security;
alter table public.posts         enable row level security;
alter table public.listings      enable row level security;
alter table public.comments      enable row level security;
alter table public.likes         enable row level security;
alter table public.notifications enable row level security;

-- ----------------------------------------------------------------------------
-- PROFILES
-- ----------------------------------------------------------------------------
-- Cualquiera puede ver los perfiles (nombre, avatar) del pueblo.
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

-- Cada usuario edita su propio perfil, pero NO puede cambiarse el rol a admin.
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
  );

-- Un admin puede editar cualquier perfil (p. ej. verificar o nombrar admins).
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- BANDOS  (leer todos; escribir solo el ayuntamiento)
-- ----------------------------------------------------------------------------
create policy "bandos_select_all"
  on public.bandos for select
  using (true);

create policy "bandos_insert_admin"
  on public.bandos for insert
  with check (public.is_admin() and author_id = auth.uid());

create policy "bandos_update_admin"
  on public.bandos for update
  using (public.is_admin());

create policy "bandos_delete_admin"
  on public.bandos for delete
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- POSTS (muro vecinal) — cualquier vecino registrado publica
-- ----------------------------------------------------------------------------
create policy "posts_select_auth"
  on public.posts for select
  to authenticated
  using (true);

create policy "posts_insert_own"
  on public.posts for insert
  to authenticated
  with check (author_id = auth.uid());

create policy "posts_update_own"
  on public.posts for update
  to authenticated
  using (author_id = auth.uid());

-- El autor borra lo suyo; el admin puede moderar (borrar) cualquier post.
create policy "posts_delete_own_or_admin"
  on public.posts for delete
  to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- LISTINGS (mercadillo)
-- ----------------------------------------------------------------------------
create policy "listings_select_auth"
  on public.listings for select
  to authenticated
  using (true);

create policy "listings_insert_own"
  on public.listings for insert
  to authenticated
  with check (author_id = auth.uid());

create policy "listings_update_own"
  on public.listings for update
  to authenticated
  using (author_id = auth.uid());

create policy "listings_delete_own_or_admin"
  on public.listings for delete
  to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- COMMENTS
-- ----------------------------------------------------------------------------
create policy "comments_select_auth"
  on public.comments for select
  to authenticated
  using (true);

create policy "comments_insert_own"
  on public.comments for insert
  to authenticated
  with check (author_id = auth.uid());

create policy "comments_delete_own_or_admin"
  on public.comments for delete
  to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- LIKES
-- ----------------------------------------------------------------------------
create policy "likes_select_auth"
  on public.likes for select
  to authenticated
  using (true);

create policy "likes_insert_own"
  on public.likes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "likes_delete_own"
  on public.likes for delete
  to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS (cada usuario ve y marca como leídas solo las suyas)
-- ----------------------------------------------------------------------------
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid());
