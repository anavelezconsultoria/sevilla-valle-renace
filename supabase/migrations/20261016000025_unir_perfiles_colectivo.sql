-- Si alguien entra COMO el colectivo (con su celular y clave) desde otro
-- navegador, el perfil del colectivo cambia de id y el viejo se borra; el
-- enlace con sus administradoras se perdia en cascada (paso con
-- Baltimore-Maryland el 2026-10-16). Ahora tambien se traslada.

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
  -- Lo que administraba el perfil viejo.
  insert into public.colectivos (perfil_id, administrador_id)
  select c.perfil_id, p_destino from public.colectivos c where c.administrador_id = any (p_origenes)
  on conflict do nothing;
  -- Si el perfil viejo ERA un colectivo: sus administradoras pasan al perfil nuevo.
  insert into public.colectivos (perfil_id, administrador_id)
  select p_destino, c.administrador_id from public.colectivos c
   where c.perfil_id = any (p_origenes) and c.administrador_id <> p_destino
  on conflict do nothing;
  delete from auth.users where id = any (p_origenes);
end
$$;

revoke execute on function public._unir_perfiles(uuid, uuid[]) from public, anon, authenticated;
