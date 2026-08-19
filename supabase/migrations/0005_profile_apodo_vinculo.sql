-- ============================================================================
-- Castigram · Apodo y vínculo familiar en el perfil
-- Muy de pueblo: identificar a la gente por su apodo y por "de quién es".
-- ============================================================================

alter table public.profiles
  add column if not exists nickname      text,   -- apodo ("el de la era")
  add column if not exists relation_type text,   -- "hija de", "nieto de"...
  add column if not exists relation_to   uuid references public.profiles (id) on delete set null,
  add column if not exists relation_name text;   -- nombre libre si no está registrado

comment on column public.profiles.nickname is 'Apodo del vecino (opcional).';
comment on column public.profiles.relation_type is 'Tipo de vínculo: hija de, nieto de, mujer de...';
comment on column public.profiles.relation_to is 'Vecino registrado con quien se tiene el vínculo (opcional).';
comment on column public.profiles.relation_name is 'Nombre escrito a mano cuando el familiar no está en la app.';

-- Evitar que alguien se ponga como "hijo de sí mismo".
alter table public.profiles
  drop constraint if exists profiles_relation_not_self;
alter table public.profiles
  add constraint profiles_relation_not_self check (relation_to is null or relation_to <> id);
