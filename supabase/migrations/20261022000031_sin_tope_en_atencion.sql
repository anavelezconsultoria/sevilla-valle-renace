-- =============================================================================
-- Sin tope de necesidades en atencion por persona (antes 5). Cada quien toma las
-- que pueda llevar; el plazo de 48 horas sigue liberando las que no entregue.
-- Misma funcion de 0001 sin la validacion del tope.
-- =============================================================================

create or replace function public.tomar_necesidad(p_necesidad uuid)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles := public._perfil_actual();
begin
  -- La condicion de estado hace la toma atomica: si dos personas intentan a la vez, solo una gana.
  update public.necesidades
     set estado = 'en_atencion', ayudante_id = v_perfil.id,
         vence_en = now() + public._horas_para_entregar(), actualizada_en = now()
   where id = p_necesidad and estado = 'registrada';
  if not found then
    raise exception 'Otra persona ya la tomó o cambió de estado.' using errcode = 'P0001';
  end if;
  perform public._registrar_evento(p_necesidad, 'tomada', v_perfil.id, v_perfil.alias);
  return p_necesidad;
end
$$;

revoke execute on function public.tomar_necesidad(uuid) from public, anon;
grant execute on function public.tomar_necesidad(uuid) to authenticated;
