-- =============================================================================
-- "Necesito mas tiempo": quien atiende una necesidad puede pedir 24 horas extra
-- UNA vez por toma, para no perderla mientras consigue la ayuda. Queda en el
-- historial publico. Si la vuelve a tomar despues de liberarse, puede pedir otra vez.
-- =============================================================================

create or replace function public._horas_extra() returns interval language sql immutable as $$ select interval '24 hours' $$;

create or replace function public.extender_plazo(p_necesidad uuid)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles := public._perfil_actual();
  v_ultima_toma timestamptz;
begin
  select max(ocurrido_en) into v_ultima_toma
    from public.eventos_necesidad
   where necesidad_id = p_necesidad and tipo = 'tomada';

  if exists (
    select 1 from public.eventos_necesidad
     where necesidad_id = p_necesidad and tipo = 'plazo_extendido' and ocurrido_en >= v_ultima_toma
  ) then
    raise exception 'Ya pediste más tiempo una vez. Si no alcanzas, libérala para que otra persona la tome.' using errcode = 'P0001';
  end if;

  update public.necesidades
     set vence_en = vence_en + public._horas_extra(), actualizada_en = now()
   where id = p_necesidad and estado = 'en_atencion' and ayudante_id = v_perfil.id;
  if not found then
    raise exception 'Esta necesidad la está atendiendo otra persona.' using errcode = 'P0001';
  end if;

  perform public._registrar_evento(p_necesidad, 'plazo_extendido', v_perfil.id, v_perfil.alias);
  return p_necesidad;
end
$$;

revoke execute on function public.extender_plazo(uuid) from public, anon;
revoke execute on function public._horas_extra() from public, anon, authenticated;
grant execute on function public.extender_plazo(uuid) to authenticated;
