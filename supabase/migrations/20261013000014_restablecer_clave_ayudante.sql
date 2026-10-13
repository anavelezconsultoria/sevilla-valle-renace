-- La coordinacion asigna una clave nueva a un CELULAR, no solo a sus solicitudes.
-- Desde 0013 el mismo celular usa una sola clave para pedir ayuda y para ayudar,
-- pero restablecer_clave_solicitante solo cambiaba necesidades_privado: a quien
-- se registro solo para ayudar le respondia "No hay solicitudes registradas".
-- Ahora cambia ambas (solicitudes y perfil de ayudante) y libera los bloqueos.

create or replace function public.restablecer_clave_solicitante(p_telefono text, p_clave text)
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles := public._perfil_actual();
  v_telefono text := public._normalizar_telefono(p_telefono);
  v_hash text;
  v_solicitudes int;
  v_perfiles int;
begin
  if v_perfil.rol <> 'coordinacion' then
    raise exception 'Solo la coordinación puede asignar claves.' using errcode = '42501';
  end if;
  perform public._validar_clave(p_clave);
  if right(v_telefono, 4) = p_clave then
    raise exception 'La clave no puede ser el final del celular. Elige otra.' using errcode = 'P0001';
  end if;

  v_hash := extensions.crypt(p_clave, extensions.gen_salt('bf', 8));

  update public.necesidades_privado set clave_hash = v_hash where telefono = v_telefono;
  get diagnostics v_solicitudes = row_count;

  update public.perfiles_privado set clave_hash = v_hash, actualizado_en = now() where celular = v_telefono;
  get diagnostics v_perfiles = row_count;

  if v_solicitudes + v_perfiles = 0 then
    raise exception 'Ese celular no está registrado: ni pidió ayuda ni entró a ayudar.' using errcode = 'P0002';
  end if;

  delete from public.accesos_solicitante where telefono = v_telefono;
  delete from public.accesos_ayudante where celular = v_telefono;
  return v_solicitudes + v_perfiles;
end
$$;
