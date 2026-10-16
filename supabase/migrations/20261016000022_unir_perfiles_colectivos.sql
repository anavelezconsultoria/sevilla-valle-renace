-- Al entrar desde otro navegador, _unir_perfiles pasa todo al perfil nuevo y
-- borra el viejo. Los colectivos que administraba el perfil viejo se borraban
-- en cascada (asi se perdio el enlace de Baltimore-Maryland el 2026-10-16).
-- Ahora tambien se trasladan al perfil nuevo antes de borrar el viejo.

create or replace function public._unir_perfiles(p_destino uuid, p_origenes uuid[])
returns void language plpgsql volatile
set search_path = ''
as $$
begin
  if coalesce(array_length(p_origenes, 1), 0) = 0 then return; end if;
  if exists (select 1 from public.perfiles where id = any (p_origenes) and rol = 'coordinacion') then
    update public.perfiles set rol = 'coordinacion' where id = p_destino;
  end if;
  update public.necesidades set ayudante_id = p_destino where ayudante_id = any (p_origenes);
  update public.eventos_necesidad set actor_id = p_destino where actor_id = any (p_origenes);
  update public.colectivos set administrador_id = p_destino where administrador_id = any (p_origenes);
  delete from auth.users where id = any (p_origenes);
end
$$;

revoke execute on function public._unir_perfiles(uuid, uuid[]) from public, anon, authenticated;
