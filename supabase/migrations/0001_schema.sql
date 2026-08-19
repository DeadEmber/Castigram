-- ============================================================================
-- Castigram · Esquema inicial
-- Red social vecinal para sustituir al bando municipal.
-- ============================================================================

-- Perfiles de usuario. Se crea uno automáticamente al registrarse (ver trigger).
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default 'Vecino',
  avatar_url  text,
  role        text not null default 'vecino' check (role in ('vecino', 'admin')),
  bio         text,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'Perfil público de cada vecino. role=admin => ayuntamiento.';

-- ----------------------------------------------------------------------------
-- Bandos oficiales (solo los publica el ayuntamiento / admin).
-- ----------------------------------------------------------------------------
create table if not exists public.bandos (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid references public.profiles (id) on delete set null,
  title       text not null check (char_length(title) between 1 and 200),
  body        text not null check (char_length(body) between 1 and 5000),
  category    text not null default 'general'
                check (category in ('general', 'agua', 'luz', 'fiestas', 'pleno', 'obras', 'sanidad', 'urgente')),
  urgent      boolean not null default false,
  image_url   text,
  created_at  timestamptz not null default now()
);

comment on table public.bandos is 'Avisos oficiales del ayuntamiento. Sustituyen al bando municipal.';
create index if not exists bandos_created_at_idx on public.bandos (created_at desc);

-- ----------------------------------------------------------------------------
-- Muro vecinal (cualquier vecino registrado puede publicar).
-- ----------------------------------------------------------------------------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 3000),
  image_url   text,
  created_at  timestamptz not null default now()
);

comment on table public.posts is 'Publicaciones del muro vecinal.';
create index if not exists posts_created_at_idx on public.posts (created_at desc);

-- ----------------------------------------------------------------------------
-- Mercadillo / tablón de anuncios.
-- ----------------------------------------------------------------------------
create table if not exists public.listings (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  description text not null check (char_length(description) between 1 and 3000),
  price_cents integer check (price_cents is null or price_cents >= 0),
  category    text not null default 'venta'
                check (category in ('venta', 'compra', 'servicio', 'alquiler', 'regalo')),
  image_url   text,
  status      text not null default 'activo' check (status in ('activo', 'cerrado')),
  created_at  timestamptz not null default now()
);

comment on table public.listings is 'Anuncios del mercadillo: se vende, se busca, servicios...';
create index if not exists listings_created_at_idx on public.listings (created_at desc);

-- ----------------------------------------------------------------------------
-- Comentarios (sobre un bando o sobre un post del muro).
-- Exactamente uno de bando_id / post_id debe estar relleno.
-- ----------------------------------------------------------------------------
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles (id) on delete cascade,
  bando_id    uuid references public.bandos (id) on delete cascade,
  post_id     uuid references public.posts (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  constraint comments_one_target check (
    (bando_id is not null)::int + (post_id is not null)::int = 1
  )
);
create index if not exists comments_bando_idx on public.comments (bando_id);
create index if not exists comments_post_idx on public.comments (post_id);

-- ----------------------------------------------------------------------------
-- Me gusta (sobre un bando o sobre un post).
-- ----------------------------------------------------------------------------
create table if not exists public.likes (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  bando_id    uuid references public.bandos (id) on delete cascade,
  post_id     uuid references public.posts (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint likes_one_target check (
    (bando_id is not null)::int + (post_id is not null)::int = 1
  )
);
-- Un usuario solo puede dar un me gusta por elemento.
create unique index if not exists likes_bando_unique on public.likes (user_id, bando_id) where bando_id is not null;
create unique index if not exists likes_post_unique  on public.likes (user_id, post_id)  where post_id is not null;

-- ----------------------------------------------------------------------------
-- Notificaciones dentro de la app (campana).
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null default 'bando',
  title       text not null,
  body        text,
  link        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, read, created_at desc);

-- ============================================================================
-- Funciones auxiliares
-- ============================================================================

-- ¿El usuario actual es admin (ayuntamiento)?
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Al registrarse un usuario en auth.users, crear su perfil automáticamente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cuando el ayuntamiento publica un bando urgente, notificar a todos los vecinos.
create or replace function public.notify_urgent_bando()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.urgent then
    insert into public.notifications (user_id, type, title, body, link)
    select p.id, 'bando_urgente',
           '🔔 Bando urgente: ' || new.title,
           left(new.body, 140),
           '/bando/' || new.id
    from public.profiles p;
  end if;
  return new;
end;
$$;

drop trigger if exists on_bando_urgent on public.bandos;
create trigger on_bando_urgent
  after insert on public.bandos
  for each row execute function public.notify_urgent_bando();
