-- ============================================================================
-- Castigram · Endurecer las funciones SECURITY DEFINER
-- Evita que se puedan invocar como RPC público a través de la API REST.
-- ============================================================================

-- Las funciones de trigger no deben ser llamables directamente por nadie.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.notify_urgent_bando() from public, anon, authenticated;

-- is_admin() solo la necesitan las políticas RLS de usuarios registrados.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
