-- La coordinacion ya existia como perfiles.rol = 'coordinacion' (esquema inicial).
-- Se usa ese rol en lugar de la columna es_coordinador de la migracion 0005, que se elimina.

create or replace function public.restablecer_clave_solicitante(p_telefono text, p_clave text)
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles := public._perfil_actual();
  v_telefono text := public._normalizar_telefono(p_telefono);
  v_cambiadas int;
begin
  if v_perfil.rol <> 'coordinacion' then
    raise exception 'Solo la coordinación puede asignar claves.' using errcode = '42501';
  end if;
  perform public._validar_clave(p_clave);
  if right(v_telefono, 4) = p_clave then
    raise exception 'La clave no puede ser el final del celular. Elige otra.' using errcode = 'P0001';
  end if;

  update public.necesidades_privado
     set clave_hash = extensions.crypt(p_clave, extensions.gen_salt('bf', 8))
   where telefono = v_telefono;
  get diagnostics v_cambiadas = row_count;
  if v_cambiadas = 0 then
    raise exception 'No hay solicitudes registradas con ese celular.' using errcode = 'P0002';
  end if;

  delete from public.accesos_solicitante where telefono = v_telefono;
  return v_cambiadas;
end
$$;

alter table public.perfiles drop column if exists es_coordinador;

revoke execute on function public.restablecer_clave_solicitante(text, text) from public, anon;
grant execute on function public.restablecer_clave_solicitante(text, text) to authenticated;
