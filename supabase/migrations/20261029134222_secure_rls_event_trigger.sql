-- The automatic RLS event trigger is not an application API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
