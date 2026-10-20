-- =============================================================================
-- Maximo 2 solicitudes activas por celular (antes 3). Activa = esperando ayuda,
-- en revision, en atencion o entregada sin confirmar. Cuando una se cierra o se
-- cancela, puede pedir otra.
-- El freno vive en un trigger sobre necesidades_privado, como el de celulares
-- bloqueados: cualquier camino que registre una solicitud se deshace completo.
-- =============================================================================

create or replace function public._maximo_activas_por_celular() returns int language sql immutable as $$ select 2 $$;

create or replace function public._frenar_exceso_activas()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.necesidades_privado pr
        join public.necesidades n on n.id = pr.necesidad_id
       where pr.telefono = new.telefono
         and n.estado in ('registrada', 'en_revision', 'en_atencion', 'entregada'))
     >= public._maximo_activas_por_celular() then
    raise exception 'Este celular ya tiene % solicitudes activas. Cuando te llegue una, podrás pedir otra.', public._maximo_activas_por_celular()
      using errcode = 'P0001';
  end if;
  return new;
end
$$;

drop trigger if exists frenar_exceso_activas on public.necesidades_privado;
create trigger frenar_exceso_activas
  before insert on public.necesidades_privado
  for each row execute function public._frenar_exceso_activas();

revoke execute on function public._maximo_activas_por_celular() from public, anon, authenticated;
revoke execute on function public._frenar_exceso_activas() from public, anon, authenticated;
