-- =============================================================================
-- Celulares bloqueados: la coordinacion puede impedir que un celular siga
-- publicando solicitudes (abuso o pedidos repetidos sin necesidad real).
-- Al bloquear, lo que ese celular tenga abierto se cierra:
--   - sin entregar (registrada, en revision, en atencion) -> cancelada
--   - ya entregada                                         -> atendida
-- El freno vive en un trigger sobre necesidades_privado: cualquier camino
-- que registre una solicitud con ese celular se deshace completo.
-- =============================================================================

create table if not exists public.celulares_bloqueados (
  telefono text primary key check (telefono ~ '^3[0-9]{9}$'),
  motivo text not null default '' check (char_length(motivo) <= 200),
  bloqueado_por uuid references public.perfiles (id) on delete set null,
  bloqueado_en timestamptz not null default now()
);

alter table public.celulares_bloqueados enable row level security;
revoke all on public.celulares_bloqueados from anon, authenticated;

/** Frena el registro si el celular esta bloqueado. Mensaje neutro, sin acusar. */
create or replace function public._frenar_celular_bloqueado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.celulares_bloqueados b where b.telefono = new.telefono) then
    raise exception 'Este celular no puede registrar solicitudes. Comunícate con la coordinación.' using errcode = 'P0001';
  end if;
  return new;
end
$$;

drop trigger if exists frenar_celular_bloqueado on public.necesidades_privado;
create trigger frenar_celular_bloqueado
  before insert on public.necesidades_privado
  for each row execute function public._frenar_celular_bloqueado();

/** Bloquea un celular y cierra lo que tenga abierto. Devuelve cuantas solicitudes cerro. */
create or replace function public.bloquear_celular(p_telefono text, p_motivo text default '')
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles := public._exigir_coordinacion();
  v_telefono text := public._normalizar_telefono(p_telefono);
  v_id uuid;
  v_cerradas int := 0;
begin
  insert into public.celulares_bloqueados (telefono, motivo, bloqueado_por)
  values (v_telefono, left(coalesce(p_motivo, ''), 200), v_perfil.id)
  on conflict (telefono) do update set motivo = excluded.motivo, bloqueado_por = excluded.bloqueado_por, bloqueado_en = now();

  for v_id in
    update public.necesidades n
       set estado = 'cancelada', vence_en = null, actualizada_en = now()
      from public.necesidades_privado pr
     where pr.necesidad_id = n.id and pr.telefono = v_telefono
       and n.estado in ('registrada', 'en_revision', 'en_atencion')
    returning n.id
  loop
    perform public._registrar_evento(v_id, 'cancelada', v_perfil.id, 'Coordinación');
    v_cerradas := v_cerradas + 1;
  end loop;

  for v_id in
    update public.necesidades n
       set estado = 'atendida', cierre = 'cerrada_automaticamente', vence_en = null, actualizada_en = now()
      from public.necesidades_privado pr
     where pr.necesidad_id = n.id and pr.telefono = v_telefono
       and n.estado = 'entregada'
    returning n.id
  loop
    perform public._registrar_evento(v_id, 'cerrada_automaticamente', v_perfil.id, 'Coordinación');
    v_cerradas := v_cerradas + 1;
  end loop;

  return v_cerradas;
end
$$;

/** Quita el bloqueo. No reabre lo que se cerro. */
create or replace function public.desbloquear_celular(p_telefono text)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  perform public._exigir_coordinacion();
  delete from public.celulares_bloqueados where telefono = public._normalizar_telefono(p_telefono);
end
$$;

revoke execute on function public._frenar_celular_bloqueado() from public, anon, authenticated;
revoke execute on function public.bloquear_celular(text, text) from public, anon;
revoke execute on function public.desbloquear_celular(text) from public, anon;
grant execute on function public.bloquear_celular(text, text) to authenticated;
grant execute on function public.desbloquear_celular(text) to authenticated;
