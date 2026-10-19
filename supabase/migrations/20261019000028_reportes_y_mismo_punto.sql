-- =============================================================================
-- Control de reventa de donaciones.
--
-- 1. Reportes de mal uso: cualquier vecino puede reportar una solicitud
--    (vende las ayudas, no vive ahi, pide muchas veces, otro). Una vez por
--    solicitud y dispositivo, con tope por hora. Solo la coordinacion los ve.
-- 2. Mismo punto, otro celular: si una solicitud nueva marca casi el mismo
--    lugar (30 m) que la de otro celular de la misma categoria en los
--    ultimos 15 dias, entra a revision. Un hogar con varios celulares no
--    puede saltarse la revision por tener otro numero.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Reportes de mal uso
-- ---------------------------------------------------------------------------
create table if not exists public.reportes_mal_uso (
  id uuid primary key default gen_random_uuid(),
  necesidad_id uuid not null references public.necesidades (id) on delete cascade,
  motivo text not null check (motivo in ('vende', 'no_vive_ahi', 'pide_mucho', 'otro')),
  nota text not null default '' check (char_length(nota) <= 300),
  -- Identificador aleatorio que guarda el navegador (no es un dato personal).
  dispositivo text not null check (dispositivo ~ '^[A-Za-z0-9-]{16,64}$'),
  creado_en timestamptz not null default now(),
  revisado_en timestamptz,
  unique (necesidad_id, dispositivo)
);

create index if not exists reportes_pendientes_idx on public.reportes_mal_uso (necesidad_id) where revisado_en is null;
create index if not exists reportes_dispositivo_idx on public.reportes_mal_uso (dispositivo, creado_en);

alter table public.reportes_mal_uso enable row level security;
revoke all on public.reportes_mal_uso from anon, authenticated;

create or replace function public._tope_reportes_por_hora() returns int language sql immutable as $$ select 5 $$;

/** Cualquiera reporta una solicitud. Repetir desde el mismo dispositivo no suma. */
create or replace function public.reportar_mal_uso(p_necesidad uuid, p_motivo text, p_nota text, p_dispositivo text)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.necesidades where id = p_necesidad and estado <> 'cancelada') then
    raise exception 'Esta solicitud ya no está disponible.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.reportes_mal_uso where dispositivo = p_dispositivo and creado_en > now() - interval '1 hour')
     >= public._tope_reportes_por_hora() then
    raise exception 'Ya enviaste varios reportes. Vuelve más tarde.' using errcode = 'P0001';
  end if;
  insert into public.reportes_mal_uso (necesidad_id, motivo, nota, dispositivo)
  values (p_necesidad, p_motivo, left(btrim(coalesce(p_nota, '')), 300), p_dispositivo)
  on conflict (necesidad_id, dispositivo) do nothing;
end
$$;

/** Solicitudes con reportes sin revisar, la mas reportada primero. Solo coordinacion. */
create or replace function public.reportes_pendientes()
returns table (
  necesidad_id uuid, titulo text, categoria public.categoria_necesidad, sector text,
  estado public.estado_necesidad, nombre text, telefono text,
  reportes bigint, motivos text[], notas text[], ultimo timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public._exigir_coordinacion();
  return query
    select n.id, n.titulo, n.categoria, n.sector, n.estado, pr.nombre, pr.telefono,
           count(*), array_agg(distinct r.motivo), array_remove(array_agg(nullif(r.nota, '') order by r.creado_en desc), null),
           max(r.creado_en)
      from public.reportes_mal_uso r
      join public.necesidades n on n.id = r.necesidad_id
      join public.necesidades_privado pr on pr.necesidad_id = n.id
     where r.revisado_en is null
     group by n.id, n.titulo, n.categoria, n.sector, n.estado, pr.nombre, pr.telefono
     order by count(*) desc, max(r.creado_en) desc;
end
$$;

/** La coordinacion marca como revisados los reportes de una solicitud. */
create or replace function public.marcar_reportes_revisados(p_necesidad uuid)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  perform public._exigir_coordinacion();
  update public.reportes_mal_uso set revisado_en = now() where necesidad_id = p_necesidad and revisado_en is null;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Mismo punto, otro celular
-- ---------------------------------------------------------------------------
create or replace function public._metros_mismo_punto() returns double precision language sql immutable as $$ select 30::double precision $$;

/** Distancia aproximada en metros (suficiente a escala de un barrio). */
create or replace function public._metros_entre(p_lat1 double precision, p_lng1 double precision, p_lat2 double precision, p_lng2 double precision)
returns double precision language sql immutable
set search_path = ''
as $$
  select sqrt(power((p_lat2 - p_lat1) * 111320, 2) + power((p_lng2 - p_lng1) * 111320 * cos(radians(p_lat1)), 2))
$$;

/** Hace cuantos dias otro celular pidio la misma categoria desde casi el mismo punto, o NULL. */
create or replace function public._dias_mismo_punto(p_telefono text, p_lat double precision, p_lng double precision, p_categoria public.categoria_necesidad)
returns int language sql stable
set search_path = ''
as $$
  select extract(day from now() - max(n.registrada_en))::int
    from public.necesidades_privado pr
    join public.necesidades n on n.id = pr.necesidad_id
   where pr.telefono <> p_telefono
     and n.categoria = p_categoria
     and n.estado <> 'cancelada'
     and n.registrada_en > now() - public._ventana_misma_categoria()
     and pr.lat between p_lat - 0.0005 and p_lat + 0.0005
     and pr.lng between p_lng - 0.0005 and p_lng + 0.0005
     and public._metros_entre(p_lat, p_lng, pr.lat, pr.lng) <= public._metros_mismo_punto()
$$;

/** Si la solicitud se iba a publicar y otro celular ya pidio desde ahi, entra a revision. */
create or replace function public._revisar_mismo_punto()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_dias int;
  v_categoria public.categoria_necesidad;
begin
  if new.motivo_revision is not null then
    return new;
  end if;
  select categoria into v_categoria from public.necesidades where id = new.necesidad_id and estado = 'registrada';
  if v_categoria is null then
    return new;
  end if;
  v_dias := public._dias_mismo_punto(new.telefono, new.lat, new.lng, v_categoria);
  if v_dias is null then
    return new;
  end if;
  new.motivo_revision := 'Otro celular pidió ' || public._nombre_categoria(v_categoria) || ' desde casi el mismo punto hace '
    || case when v_dias = 0 then 'menos de un día' when v_dias = 1 then '1 día' else v_dias || ' días' end || '.';
  update public.necesidades set estado = 'en_revision', actualizada_en = now() where id = new.necesidad_id;
  return new;
end
$$;

/** El evento de revision va despues del de registro, para que la linea de tiempo quede en orden. */
create or replace function public._evento_revision_mismo_punto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.necesidades_privado pr
      join public.necesidades n on n.id = pr.necesidad_id
     where pr.necesidad_id = new.necesidad_id and n.estado = 'en_revision'
       and pr.motivo_revision like 'Otro celular pidió%'
  ) then
    perform public._registrar_evento(new.necesidad_id, 'en_revision', null, 'Sevilla Renace');
  end if;
  return new;
end
$$;

drop trigger if exists evento_revision_mismo_punto on public.eventos_necesidad;
create trigger evento_revision_mismo_punto
  after insert on public.eventos_necesidad
  for each row when (new.tipo = 'registrada')
  execute function public._evento_revision_mismo_punto();

drop trigger if exists revisar_mismo_punto on public.necesidades_privado;
create trigger revisar_mismo_punto
  before insert on public.necesidades_privado
  for each row execute function public._revisar_mismo_punto();

revoke execute on function public._tope_reportes_por_hora() from public, anon, authenticated;
revoke execute on function public._metros_mismo_punto() from public, anon, authenticated;
revoke execute on function public._metros_entre(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke execute on function public._dias_mismo_punto(text, double precision, double precision, public.categoria_necesidad) from public, anon, authenticated;
revoke execute on function public._revisar_mismo_punto() from public, anon, authenticated;
revoke execute on function public._evento_revision_mismo_punto() from public, anon, authenticated;
revoke execute on function public.reportar_mal_uso(uuid, text, text, text) from public;
revoke execute on function public.reportes_pendientes() from public, anon;
revoke execute on function public.marcar_reportes_revisados(uuid) from public, anon;
grant execute on function public.reportar_mal_uso(uuid, text, text, text) to anon, authenticated;
grant execute on function public.reportes_pendientes() to authenticated;
grant execute on function public.marcar_reportes_revisados(uuid) to authenticated;
